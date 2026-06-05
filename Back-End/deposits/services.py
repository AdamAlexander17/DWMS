from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from .models import ChannelNotification, DepositLog

THRESHOLD_WARNING   = Decimal('50')
THRESHOLD_DANGER    = Decimal('80')
THRESHOLD_EXHAUSTED = Decimal('85')   # Block channel at 85% daily limit


class CapacityService:

    @staticmethod
    def get_collected_today(channel_type: str, channel_id: int) -> Decimal:
        today = timezone.localdate()
        result = DepositLog.objects.filter(
            channel_type=channel_type,
            channel_id=channel_id,
            deposit_at__date=today,
        ).aggregate(total=Sum('amount'))['total']
        return result or Decimal('0')

    @staticmethod
    def get_capacity_info(channel_type: str, channel_id: int, daily_limit) -> dict:
        collected = CapacityService.get_collected_today(channel_type, channel_id)
        if not daily_limit:
            return {
                'daily_limit':     None,
                'collected_today': str(collected),
                'remaining':       None,
                'percent_used':    0,
                'capacity_status': 'no_limit',
            }
        daily_limit = Decimal(str(daily_limit))
        remaining = max(Decimal('0'), daily_limit - collected)
        percent = min(
            Decimal('100'),
            (collected / daily_limit * Decimal('100')).quantize(Decimal('0.01')),
        )
        if percent >= THRESHOLD_EXHAUSTED:
            status = 'exhausted'
        elif percent >= THRESHOLD_DANGER:
            status = 'danger'
        elif percent >= THRESHOLD_WARNING:
            status = 'warning'
        else:
            status = 'healthy'
        return {
            'daily_limit':     str(daily_limit),
            'collected_today': str(collected),
            'remaining':       str(remaining),
            'percent_used':    float(percent),
            'capacity_status': status,
        }

    @staticmethod
    def _get_channel_instance(channel_type: str, channel_id: int):
        from payments.models import BankAccount, QRCode, UPISource
        model_map = {
            DepositLog.CHANNEL_QR:   QRCode,
            DepositLog.CHANNEL_UPI:  UPISource,
            DepositLog.CHANNEL_BANK: BankAccount,
        }
        model = model_map.get(channel_type)
        if not model:
            return None
        try:
            return model.objects.select_related('brand').get(pk=channel_id)
        except model.DoesNotExist:
            return None

    @staticmethod
    def _get_channel_label(channel_type: str, instance) -> str:
        if channel_type == DepositLog.CHANNEL_QR:
            return instance.qr_name
        if channel_type == DepositLog.CHANNEL_UPI:
            return instance.upi_id
        if channel_type == DepositLog.CHANNEL_BANK:
            return f'{instance.bank_name} – {instance.account_number}'
        return str(instance)

    @staticmethod
    @transaction.atomic
    def check_and_notify(channel_type: str, channel_id: int) -> None:
        """
        Called after a deposit is logged.
        Fires notifications at 50% / 80% / 100% (once per day per level).
        Auto-deactivates the channel when the daily limit is exhausted.
        """
        instance = CapacityService._get_channel_instance(channel_type, channel_id)
        if not instance or not instance.daily_limit:
            return

        info = CapacityService.get_capacity_info(channel_type, channel_id, instance.daily_limit)
        percent = Decimal(str(info['percent_used']))
        today = timezone.localdate()

        if percent >= THRESHOLD_EXHAUSTED:
            levels_to_fire = [
                ChannelNotification.LEVEL_EXHAUSTED,
                ChannelNotification.LEVEL_DANGER,
                ChannelNotification.LEVEL_WARNING,
            ]
        elif percent >= THRESHOLD_DANGER:
            levels_to_fire = [ChannelNotification.LEVEL_DANGER, ChannelNotification.LEVEL_WARNING]
        elif percent >= THRESHOLD_WARNING:
            levels_to_fire = [ChannelNotification.LEVEL_WARNING]
        else:
            levels_to_fire = []

        label = CapacityService._get_channel_label(channel_type, instance)

        for level in levels_to_fire:
            already_sent = ChannelNotification.objects.filter(
                channel_type=channel_type,
                channel_id=channel_id,
                level=level,
                created_at__date=today,
            ).exists()
            if not already_sent:
                ChannelNotification.objects.create(
                    channel_type=channel_type,
                    channel_id=channel_id,
                    channel_label=label,
                    brand=instance.brand,
                    level=level,
                    percent_used=percent,
                )

        # Channels are NOT deactivated – they remain visible but are
        # blocked from accepting new deposits at 85% (enforced in serializer).


class DepositService:

    @staticmethod
    @transaction.atomic
    def create(validated_data: dict) -> DepositLog:
        channel_type = validated_data['channel_type']
        channel_id   = validated_data['channel_id']
        deposit = DepositLog.objects.create(**validated_data)
        CapacityService.check_and_notify(channel_type, channel_id)
        return deposit
