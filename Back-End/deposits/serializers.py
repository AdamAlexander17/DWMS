from rest_framework import serializers

from common.file_validators import validate_slip, validate_attachment
from common.validators import validate_text

from master.serializers import GatewaySerializer
from .models import DepositLog, DepositNotification, DepositActivity, DepositMessage


class DepositLogSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()
    reviewed_by_name  = serializers.SerializerMethodField()
    message_count     = serializers.SerializerMethodField()

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
            'ark_id',
            'problem_category',
            'comment',
            'submitted_by', 'submitted_by_name',
            'status', 'status_display',
            'review_message',
            'review_slip',
            'reviewed_by', 'reviewed_by_name',
            'reviewed_at',
            'message_count',
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

    def get_message_count(self, obj) -> int:
        """Return unread message count for the current user."""
        request = self.context.get('request')
        if not request:
            return 0
        user = request.user
        last_read = getattr(obj, '_last_read', None)
        qs = obj.messages.exclude(sender=user)
        if last_read:
            qs = qs.filter(created_at__gt=last_read)
        return qs.count()

    def get_channel_label(self, obj) -> str | None:
        if obj.channel_type == DepositLog.CHANNEL_QR and obj.qr_code:
            return obj.qr_code.qr_name
        if obj.channel_type == DepositLog.CHANNEL_UPI and obj.upi_source:
            return obj.upi_source.upi_id
        if obj.channel_type == DepositLog.CHANNEL_BANK and obj.bank_account:
            return f'{obj.bank_account.bank_name} – {obj.bank_account.account_number}'
        return None

    def validate_slip(self, value):
        if value is None:
            return value
        validate_slip(value, field='Deposit slip')
        return value

    def validate_review_slip(self, value):
        if value is None:
            return value
        validate_slip(value, field='Review slip')
        return value

    def validate_comment(self, value):
        return validate_text(value, field='Comment', max_length=2000, allow_blank=True)

    def validate_ark_id(self, value):
        value = validate_text(value, field='ARK ID', max_length=100, allow_blank=False)
        if not value.isdigit():
            raise serializers.ValidationError('ARK ID must contain only integers.')
        return value

    def validate_gateway(self, value):
        return value

    def validate(self, attrs):
        ark_id = attrs.get('ark_id', getattr(self.instance, 'ark_id', ''))
        if not str(ark_id).strip():
            raise serializers.ValidationError({'ark_id': 'ARK ID is required.'})

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

        # Slip status consistency
        slip        = attrs.get('slip',        getattr(self.instance, 'slip',        None))
        slip_status = attrs.get('slip_status', getattr(self.instance, 'slip_status', None))
        if slip_status == DepositLog.SLIP_ADDED and not slip:
            raise serializers.ValidationError(
                {'slip': 'A slip file is required when slip_status is "added".'}
            )

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
            'deposit_log',
        ]
        read_only_fields = fields


class DepositActivitySerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = DepositActivity
        fields = ['id', 'action', 'message', 'slip_url', 'extra', 'actor', 'actor_name', 'created_at']
        read_only_fields = fields

    def get_actor_name(self, obj) -> str | None:
        return obj.actor.username if obj.actor else None


class DepositMessageSerializer(serializers.ModelSerializer):
    sender_name        = serializers.SerializerMethodField()
    attachment_url     = serializers.SerializerMethodField()
    attachment_size_kb = serializers.SerializerMethodField()
    read_status        = serializers.SerializerMethodField()

    def get_sender_name(self, obj):
        return obj.sender.username if obj.sender_id else 'Deleted user'

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.attachment.url) if request else obj.attachment.url

    def get_attachment_size_kb(self, obj):
        try:
            return round(obj.attachment.size / 1024, 1) if obj.attachment else None
        except Exception:
            return None

    def get_read_status(self, obj):
        """
        Returns: 'sent' (single tick), 'delivered' (double grey tick), 'read' (double blue tick)
        """
        from .models import DepositMessageRead
        # Check if any other user has read messages up to this message's timestamp
        read_count = DepositMessageRead.objects.filter(
            deposit_id=obj.deposit_id,
            last_read_at__gte=obj.created_at,
        ).exclude(user_id=obj.sender_id).count()
        if read_count > 0:
            return 'read'       # double blue tick
        return 'delivered'      # double grey tick (server received)

    class Meta:
        model = DepositMessage
        fields = [
            'id', 'deposit_id', 'sender', 'sender_name', 'sender_role',
            'message', 'attachment_url', 'attachment_name', 'attachment_size_kb',
            'is_protected', 'password_hint', 'read_status', 'created_at',
        ]


class PostDepositMessageSerializer(serializers.Serializer):
    message       = serializers.CharField(required=False, allow_blank=True, default='', max_length=5000)
    attachment    = serializers.FileField(required=False, allow_null=True)
    is_protected  = serializers.BooleanField(required=False, default=False)
    password_hint = serializers.CharField(required=False, allow_blank=True, default='', max_length=200)

    def validate_message(self, value):
        return validate_text(value, field='Message', max_length=5000, allow_blank=True)

    def validate_password_hint(self, value):
        return validate_text(value, field='Password hint', max_length=200, allow_blank=True)

    def validate_attachment(self, value):
        if value is None:
            return value
        validate_attachment(value, field='Attachment')
        return value

    def validate(self, attrs):
        msg = (attrs.get('message') or '').strip()
        att = attrs.get('attachment')
        if not msg and not att:
            raise serializers.ValidationError('Please type a message or attach a file.')
        if attrs.get('is_protected') and not att:
            raise serializers.ValidationError(
                {'is_protected': 'A protected message must include an attachment.'}
            )
        return attrs
