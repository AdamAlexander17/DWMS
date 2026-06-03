from rest_framework import serializers

from .models import Brand


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ['id', 'name', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class BrandWriteSerializer(serializers.ModelSerializer):
    """Used for create and update operations."""

    class Meta:
        model = Brand
        fields = ['name']

    def validate_name(self, value: str) -> str:
        return value.upper().strip()
