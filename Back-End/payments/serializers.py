from rest_framework import serializers

from common.utils import validate_image_file

from .models import BankAccount, QRCode, UPISource


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_range(attrs, instance=None):
    """Ensure range_from < range_to, supporting partial updates."""
    range_from = attrs.get('range_from', getattr(instance, 'range_from', None))
    range_to = attrs.get('range_to', getattr(instance, 'range_to', None))
    if range_from is not None and range_to is not None:
        if range_from >= range_to:
            raise serializers.ValidationError(
                {'range_to': 'range_to must be greater than range_from'}
            )


# ---------------------------------------------------------------------------
# QR Code
# ---------------------------------------------------------------------------

class QRCodeSerializer(serializers.ModelSerializer):
    brand_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = QRCode
        fields = [
            'id', 'brand', 'brand_name', 'qr_name', 'qr_image',
            'range_from', 'range_to', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_brand_name(self, obj) -> str:
        return obj.brand.name if obj.brand else None

    def get_created_by_name(self, obj) -> str:
        return obj.created_by.username if obj.created_by else None

    def validate_qr_image(self, value):
        validate_image_file(value)
        return value

    def validate(self, attrs):
        _validate_range(attrs, self.instance)
        return attrs

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


# ---------------------------------------------------------------------------
# UPI Source
# ---------------------------------------------------------------------------

class UPISourceSerializer(serializers.ModelSerializer):
    brand_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = UPISource
        fields = [
            'id', 'brand', 'brand_name', 'upi_id',
            'range_from', 'range_to', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_brand_name(self, obj) -> str:
        return obj.brand.name if obj.brand else None

    def get_created_by_name(self, obj) -> str:
        return obj.created_by.username if obj.created_by else None

    def validate(self, attrs):
        _validate_range(attrs, self.instance)
        return attrs

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


# ---------------------------------------------------------------------------
# Bank Account
# ---------------------------------------------------------------------------

class BankAccountSerializer(serializers.ModelSerializer):
    brand_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = BankAccount
        fields = [
            'id', 'brand', 'brand_name',
            'bank_name', 'account_holder_name', 'account_number',
            'ifsc_code', 'branch_name',
            'range_from', 'range_to', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_brand_name(self, obj) -> str:
        return obj.brand.name if obj.brand else None

    def get_created_by_name(self, obj) -> str:
        return obj.created_by.username if obj.created_by else None

    def validate(self, attrs):
        _validate_range(attrs, self.instance)
        return attrs

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
