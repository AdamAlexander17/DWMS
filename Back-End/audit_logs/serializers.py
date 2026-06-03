from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'username',
            'action', 'module', 'old_data', 'new_data',
            'ip_address', 'timestamp',
        ]
        read_only_fields = fields

    def get_username(self, obj) -> str:
        return obj.user.username if obj.user else None
