from rest_framework import serializers

from .models import ChannelNotification, DepositLog


class DepositLogSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()
    brand_name        = serializers.SerializerMethodField()
    channel_label     = serializers.SerializerMethodField()
    reviewed_by_name  = serializers.SerializerMethodField()

    class Meta:
        model = DepositLog
        fields = [
            'id', 'channel_type', 'channel_id', 'channel_label',
            'brand', 'brand_name',
            'submitted_by', 'submitted_by_name',
            'client_name', 'amount', 'utr_number', 'deposit_at',
            'remarks', 'created_at',
            'status', 'review_message', 'reviewed_by', 'reviewed_by_name', 'reviewed_at',
        ]
        read_only_fields = [
            'id', 'submitted_by', 'brand', 'created_at',
            'status', 'review_message', 'reviewed_by', 'reviewed_at',
        ]

    def get_submitted_by_name(self, obj) -> str | None:
        return obj.submitted_by.username if obj.submitted_by else None

    def get_brand_name(self, obj) -> str | None:
        return obj.brand.name if obj.brand else None

    def get_reviewed_by_name(self, obj) -> str | None:
        return obj.reviewed_by.username if obj.reviewed_by else None

    def get_channel_label(self, obj) -> str | None:
        from payments.models import BankAccount, QRCode, UPISource
        model_map = {
            DepositLog.CHANNEL_QR:   (QRCode,       lambda i: i.qr_name),
            DepositLog.CHANNEL_UPI:  (UPISource,    lambda i: i.upi_id),
            DepositLog.CHANNEL_BANK: (BankAccount,  lambda i: f'{i.bank_name} – {i.account_number}'),
        }
        entry = model_map.get(obj.channel_type)
        if not entry:
            return None
        model, label_fn = entry
        try:
            return label_fn(model.objects.get(pk=obj.channel_id))
        except model.DoesNotExist:
            return None

    def validate(self, attrs):
        # On update (PATCH), skip channel and brand re-validation
        if self.instance:
            utr = attrs.get('utr_number', '')
            if utr:
                qs = DepositLog.objects.filter(utr_number=utr).exclude(pk=self.instance.pk)
                if qs.exists():
                    raise serializers.ValidationError(
                        {'utr_number': 'This UTR number has already been logged.'}
                    )
            return attrs

        from payments.models import BankAccount, QRCode, UPISource
        channel_type = attrs.get('channel_type')
        channel_id   = attrs.get('channel_id')
        model_map = {
            DepositLog.CHANNEL_QR:   QRCode,
            DepositLog.CHANNEL_UPI:  UPISource,
            DepositLog.CHANNEL_BANK: BankAccount,
        }
        model = model_map.get(channel_type)
        if not model:
            raise serializers.ValidationError({'channel_type': 'Invalid channel type.'})
        try:
            channel = model.objects.get(pk=channel_id, is_active=True)
        except model.DoesNotExist:
            raise serializers.ValidationError({'channel_id': 'Channel not found or is inactive.'})

        # Block deposit if channel has reached 85% of its daily limit
        from .services import CapacityService
        cap = CapacityService.get_capacity_info(channel_type, channel_id, channel.daily_limit)
        if cap['capacity_status'] == 'exhausted':
            pct = cap['percent_used']
            raise serializers.ValidationError(
                f'This channel has reached {pct:.0f}% of its daily limit and is blocked for new deposits today.'
            )

        # Validate amount is within the channel's allowed range
        from decimal import Decimal as D
        amount = D(str(attrs.get('amount', 0)))
        if amount < D(str(channel.range_from)):
            raise serializers.ValidationError(
                {'amount': f'Minimum deposit for this channel is ₹{channel.range_from}.'}
            )
        if amount > D(str(channel.range_to)):
            raise serializers.ValidationError(
                {'amount': f'Maximum deposit for this channel is ₹{channel.range_to}.'}
            )

        # Derive brand from the channel
        attrs['brand'] = channel.brand

        # UTR uniqueness – prevent duplicate deposit entries
        utr = attrs.get('utr_number', '')
        if utr:
            if DepositLog.objects.filter(utr_number=utr).exists():
                raise serializers.ValidationError(
                    {'utr_number': 'This UTR number has already been logged.'}
                )
        return attrs

    def create(self, validated_data):
        validated_data['submitted_by'] = self.context['request'].user
        from .services import DepositService
        return DepositService.create(validated_data)


class ChannelNotificationSerializer(serializers.ModelSerializer):
    brand_name = serializers.SerializerMethodField()

    class Meta:
        model = ChannelNotification
        fields = [
            'id', 'channel_type', 'channel_id', 'channel_label',
            'brand', 'brand_name', 'level', 'percent_used',
            'is_read', 'created_at',
        ]
        read_only_fields = [
            'id', 'channel_type', 'channel_id', 'channel_label',
            'brand', 'level', 'percent_used', 'created_at',
        ]

    def get_brand_name(self, obj) -> str | None:
        return obj.brand.name if obj.brand else None
