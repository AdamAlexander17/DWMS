from rest_framework import serializers

from .models import Withdrawal, WithdrawalMessage, WithdrawalNotification


class WithdrawalSerializer(serializers.ModelSerializer):
    submitted_by_name     = serializers.SerializerMethodField()
    reviewed_by_name      = serializers.SerializerMethodField()
    slip_uploaded_by_name = serializers.SerializerMethodField()
    brand_name            = serializers.SerializerMethodField()
    slip_url              = serializers.SerializerMethodField()

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


class WithdrawalReviewSerializer(serializers.Serializer):
    action         = serializers.ChoiceField(choices=['approve', 'reject'])
    review_message = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs['action'] == 'reject' and not attrs.get('review_message', '').strip():
            raise serializers.ValidationError(
                {'review_message': 'A reason is required when rejecting a withdrawal.'}
            )
        return attrs


class UploadSlipSerializer(serializers.Serializer):
    slip = serializers.FileField()
    note = serializers.CharField(required=False, allow_blank=True, default='')


class NotReceivedSerializer(serializers.Serializer):
    followup_remarks = serializers.CharField()

    def validate_followup_remarks(self, v):
        if not v.strip():
            raise serializers.ValidationError('Remarks are required.')
        return v


class EmailSentSerializer(serializers.Serializer):
    bank_followup_note = serializers.CharField(required=False, allow_blank=True, default='')


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

    class Meta:
        model = WithdrawalMessage
        fields = [
            'id', 'withdrawal_id', 'sender', 'sender_name', 'sender_role',
            'message', 'attachment_url', 'attachment_name', 'attachment_size_kb',
            'is_protected', 'password_hint', 'created_at',
        ]


class PostMessageSerializer(serializers.Serializer):
    message       = serializers.CharField(required=False, allow_blank=True, default='')
    attachment    = serializers.FileField(required=False, allow_null=True)
    is_protected  = serializers.BooleanField(required=False, default=False)
    password_hint = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        msg = (attrs.get('message') or '').strip()
        att = attrs.get('attachment')
        if not msg and not att:
            raise serializers.ValidationError('Please type a message or attach a file.')
        return attrs


class ManualCloseSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default='')
