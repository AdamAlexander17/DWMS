from rest_framework import serializers

from common.file_validators import validate_attachment, validate_slip
from common.validators import (
    validate_client_arc_id,
    validate_positive_amount,
    validate_safe_name,
    validate_text,
)

from .models import Withdrawal, WithdrawalMessage, WithdrawalNotification


class WithdrawalSerializer(serializers.ModelSerializer):
    submitted_by_name     = serializers.SerializerMethodField()
    reviewed_by_name      = serializers.SerializerMethodField()
    slip_uploaded_by_name = serializers.SerializerMethodField()
    brand_name            = serializers.SerializerMethodField()
    slip_url              = serializers.SerializerMethodField()
    message_count         = serializers.SerializerMethodField()

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.username if obj.submitted_by_id else None

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.username if obj.reviewed_by_id else None

    def get_slip_uploaded_by_name(self, obj):
        return obj.slip_uploaded_by.username if obj.slip_uploaded_by_id else None

    def get_brand_name(self, obj):
        return obj.brand.name if obj.brand_id else None

    def get_slip_url(self, obj):
        if not obj.slip:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(obj.slip.url) if request else obj.slip.url

    def get_message_count(self, obj):
        """Count unread message notifications for the current user on this ticket."""
        request = self.context.get('request')
        if not request or not request.user:
            return 0
        from .models import WithdrawalNotification
        return WithdrawalNotification.objects.filter(
            recipient=request.user,
            withdrawal=obj,
            notif_type='new_message',
            is_read=False,
        ).count()

    class Meta:
        model  = Withdrawal
        fields = [
            'id', 'client_arc_id', 'client_name', 'amount',
            'withdrawal_datetime', 'comment', 'status',
            'slip_url', 'slip_note', 'slip_uploaded_at',
            'slip_uploaded_by', 'slip_uploaded_by_name',
            'followup_remarks',
            'bank_followup_note', 'email_sent_at',
            'review_message',
            'brand', 'brand_name',
            'submitted_by', 'submitted_by_name',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at',
            'message_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'status',
            'slip_url', 'slip_note', 'slip_uploaded_at', 'slip_uploaded_by',
            'followup_remarks', 'bank_followup_note', 'email_sent_at',
            'review_message', 'brand',
            'submitted_by', 'reviewed_by', 'reviewed_at',
            'created_at', 'updated_at',
        ]

    def validate_client_arc_id(self, value):
        return validate_client_arc_id(value)

    def validate_client_name(self, value):
        return validate_safe_name(value, field='Client name', max_length=150)

    def validate_amount(self, value):
        return validate_positive_amount(value, field='Amount')

    def validate_comment(self, value):
        return validate_text(value, field='Comment', max_length=2000, allow_blank=True)


class WithdrawalReviewSerializer(serializers.Serializer):
    action         = serializers.ChoiceField(choices=['approve', 'reject'])
    review_message = serializers.CharField(required=False, allow_blank=True, max_length=1000)

    def validate(self, attrs):
        if attrs['action'] == 'reject' and not attrs.get('review_message', '').strip():
            raise serializers.ValidationError(
                {'review_message': 'A reason is required when rejecting a withdrawal.'}
            )
        return attrs


class UploadSlipSerializer(serializers.Serializer):
    slip = serializers.FileField()
    note = serializers.CharField(required=False, allow_blank=True, default='', max_length=1000)

    def validate_slip(self, value):
        validate_slip(value, field='Slip')
        return value

    def validate_note(self, value):
        return validate_text(value, field='Note', max_length=1000, allow_blank=True)


class NotReceivedSerializer(serializers.Serializer):
    followup_remarks = serializers.CharField(max_length=2000)

    def validate_followup_remarks(self, v):
        return validate_text(v, field='Remarks', max_length=2000, min_length=3, allow_blank=False)


class EmailSentSerializer(serializers.Serializer):
    bank_followup_note = serializers.CharField(required=False, allow_blank=True, default='', max_length=2000)

    def validate_bank_followup_note(self, v):
        return validate_text(v, field='Note', max_length=2000, allow_blank=True)


class WithdrawalNotificationSerializer(serializers.ModelSerializer):
    withdrawal_client = serializers.CharField(source='withdrawal.client_name', read_only=True)
    withdrawal_arc_id = serializers.CharField(source='withdrawal.client_arc_id', read_only=True)
    withdrawal_status = serializers.CharField(source='withdrawal.status',      read_only=True)

    class Meta:
        model  = WithdrawalNotification
        fields = [
            'id', 'withdrawal_id', 'withdrawal_client', 'withdrawal_arc_id',
            'withdrawal_status', 'notif_type', 'message',
            'is_read', 'created_at',
        ]


class WithdrawalMessageSerializer(serializers.ModelSerializer):
    sender_name    = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    attachment_size_kb = serializers.SerializerMethodField()
    read_status    = serializers.SerializerMethodField()

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
        """Returns: 'sent', 'delivered', or 'read' for WhatsApp-style ticks."""
        from .models import WithdrawalMessageRead
        # Check if any other user has read messages up to this message's timestamp
        read_count = WithdrawalMessageRead.objects.filter(
            withdrawal_id=obj.withdrawal_id,
            last_read_at__gte=obj.created_at,
        ).exclude(user_id=obj.sender_id).count()
        if read_count > 0:
            return 'read'       # double blue tick
        return 'delivered'      # double grey tick

    class Meta:
        model = WithdrawalMessage
        fields = [
            'id', 'withdrawal_id', 'sender', 'sender_name', 'sender_role',
            'message', 'attachment_url', 'attachment_name', 'attachment_size_kb',
            'is_protected', 'password_hint', 'read_status', 'created_at',
        ]


class PostMessageSerializer(serializers.Serializer):
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


class ManualCloseSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default='', max_length=1000)

    def validate_note(self, value):
        return validate_text(value, field='Note', max_length=1000, allow_blank=True)
