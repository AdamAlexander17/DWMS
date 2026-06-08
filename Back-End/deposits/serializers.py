from rest_framework import serializers

from master.serializers import GatewaySerializer
from .models import DepositLog, DepositNotification


class DepositLogSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()
    reviewed_by_name  = serializers.SerializerMethodField()

    # Nested gateway detail (read)
    gateway_detail = GatewaySerializer(source='gateway', read_only=True)

    # Human-readable labels for choice fields
    channel_type_display  = serializers.CharField(source='get_channel_type_display',  read_only=True)
    slip_status_display   = serializers.CharField(source='get_slip_status_display',   read_only=True)
    status_display        = serializers.CharField(source='get_status_display',        read_only=True)

    # Resolved label of the linked channel object (name / UPI ID / bank name)
    channel_label = serializers.SerializerMethodField()

    class Meta:
        model = DepositLog
        fields = [
            'id',
            'gateway', 'gateway_detail',
            'channel_type', 'channel_type_display',
            'qr_code', 'upi_source', 'bank_account',
            'channel_label',
            'slip',
            'slip_status', 'slip_status_display',
            'comment',
            'submitted_by', 'submitted_by_name',
            'status', 'status_display',
            'review_message',
            'review_slip',
            'reviewed_by', 'reviewed_by_name',
            'reviewed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'submitted_by', 'created_at', 'updated_at',
            'review_message', 'reviewed_by', 'reviewed_at',
        ]

    def get_submitted_by_name(self, obj) -> str | None:
        return obj.submitted_by.username if obj.submitted_by else None

    def get_reviewed_by_name(self, obj) -> str | None:
        return obj.reviewed_by.username if obj.reviewed_by else None

    def get_channel_label(self, obj) -> str | None:
        if obj.channel_type == DepositLog.CHANNEL_QR and obj.qr_code:
            return obj.qr_code.qr_name
        if obj.channel_type == DepositLog.CHANNEL_UPI and obj.upi_source:
            return obj.upi_source.upi_id
        if obj.channel_type == DepositLog.CHANNEL_BANK and obj.bank_account:
            return f'{obj.bank_account.bank_name} – {obj.bank_account.account_number}'
        return None

    def validate(self, attrs):
        channel_type = attrs.get('channel_type', getattr(self.instance, 'channel_type', None))
        qr_code      = attrs.get('qr_code',      getattr(self.instance, 'qr_code',      None))
        upi_source   = attrs.get('upi_source',   getattr(self.instance, 'upi_source',   None))
        bank_account = attrs.get('bank_account', getattr(self.instance, 'bank_account', None))

        if channel_type == DepositLog.CHANNEL_QR and not qr_code:
            raise serializers.ValidationError({'qr_code': 'A QR Code must be selected for channel type "qr".'})
        if channel_type == DepositLog.CHANNEL_UPI and not upi_source:
            raise serializers.ValidationError({'upi_source': 'A UPI Source must be selected for channel type "upi".'})
        if channel_type == DepositLog.CHANNEL_BANK and not bank_account:
            raise serializers.ValidationError({'bank_account': 'A Bank Account must be selected for channel type "bank".'})

        # Clear irrelevant FK fields to keep data clean
        if channel_type != DepositLog.CHANNEL_QR:
            attrs['qr_code'] = None
        if channel_type != DepositLog.CHANNEL_UPI:
            attrs['upi_source'] = None
        if channel_type != DepositLog.CHANNEL_BANK:
            attrs['bank_account'] = None

        return attrs

    def create(self, validated_data):
        validated_data['submitted_by'] = self.context['request'].user
        return DepositLog.objects.create(**validated_data)


class DepositNotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DepositNotification
        fields = [
            'id', 'level', 'channel_label', 'message',
            'percent_used', 'is_read', 'created_at',
        ]
        read_only_fields = fields
