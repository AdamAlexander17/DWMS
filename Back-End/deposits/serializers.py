from rest_framework import serializers

from .models import DepositLog


class DepositLogSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()
    reviewed_by_name  = serializers.SerializerMethodField()

    # Expose human-readable labels for choice fields
    gateway_name_display = serializers.CharField(
        source='get_gateway_name_display', read_only=True
    )
    slip_status_display = serializers.CharField(
        source='get_slip_status_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = DepositLog
        fields = [
            'id',
            'gateway_name', 'gateway_name_display',
            'slip',
            'slip_status', 'slip_status_display',
            'comment',
            'submitted_by', 'submitted_by_name',
            'status', 'status_display',
            'review_message',
            'reviewed_by', 'reviewed_by_name',
            'reviewed_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'submitted_by', 'created_at', 'updated_at',
            'status', 'review_message', 'reviewed_by', 'reviewed_at',
        ]

    def get_submitted_by_name(self, obj) -> str | None:
        return obj.submitted_by.username if obj.submitted_by else None

    def get_reviewed_by_name(self, obj) -> str | None:
        return obj.reviewed_by.username if obj.reviewed_by else None

    def create(self, validated_data):
        validated_data['submitted_by'] = self.context['request'].user
        return DepositLog.objects.create(**validated_data)
