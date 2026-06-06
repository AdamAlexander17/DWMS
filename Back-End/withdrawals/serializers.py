from rest_framework import serializers

from .models import Withdrawal


class WithdrawalSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()
    reviewed_by_name  = serializers.SerializerMethodField()
    brand_name        = serializers.SerializerMethodField()

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.username if obj.submitted_by_id else None

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.username if obj.reviewed_by_id else None

    def get_brand_name(self, obj):
        return obj.brand.name if obj.brand_id else None

    class Meta:
        model  = Withdrawal
        fields = [
            'id', 'client_arc_id', 'client_name', 'amount',
            'withdrawal_datetime', 'attachment', 'comment',
            'status', 'review_message',
            'brand', 'brand_name',
            'submitted_by', 'submitted_by_name',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'status', 'review_message',
            'brand',
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
