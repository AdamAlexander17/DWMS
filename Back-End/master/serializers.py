from rest_framework import serializers

from common.validators import validate_brand_name

from .models import Gateway


class GatewaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Gateway
        fields = ['id', 'name', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class GatewayWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Gateway
        fields = ['name']

    def validate_name(self, value: str) -> str:
        value = validate_brand_name(value)
        qs = Gateway.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(f"Gateway '{value}' already exists.")
        return value
