from rest_framework import serializers

from common.validators import validate_brand_name

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
        name = validate_brand_name(value)
        qs = Brand.objects.filter(name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A brand with this name already exists.')
        return name
