from rest_framework import serializers

from common.file_validators import validate_qr_image as fv_validate_qr_image
from common.utils import validate_image_file
from common.validators import (
    validate_account_number,
    validate_ifsc,
    validate_positive_amount,
    validate_range,
    validate_safe_name,
    validate_text,
    validate_upi_vpa,
)

from .models import BankAccount, QRCode, UPISource


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_range(attrs, instance=None):
    """Ensure range_from < range_to, supporting partial updates."""
    range_from = attrs.get('range_from', getattr(instance, 'range_from', None))
    range_to = attrs.get('range_to', getattr(instance, 'range_to', None))
    validate_range(range_from, range_to)


def _validate_daily_limit(attrs, instance=None):
    daily = attrs.get('daily_limit', getattr(instance, 'daily_limit', None))
    if daily is None:
        return
    range_to = attrs.get('range_to', getattr(instance, 'range_to', None))
    # daily_limit must be ≥ range_to (a single high-value txn shouldn't exceed the daily cap)
    if range_to is not None and daily < range_to:
        raise serializers.ValidationError(
            {'daily_limit': 'Daily limit must be ≥ range_to.'}
        )


# ---------------------------------------------------------------------------
# QR Code
# ---------------------------------------------------------------------------

class QRCodeSerializer(serializers.ModelSerializer):
    brand_name      = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = QRCode
        fields = [
            'id', 'brand', 'brand_name', 'qr_name', 'qr_image',
            'range_from', 'range_to', 'daily_limit', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_brand_name(self, obj) -> str:
        return obj.brand.name if obj.brand else None

    def get_created_by_name(self, obj) -> str:
        return obj.created_by.username if obj.created_by else None

    def validate_qr_image(self, value):
        fv_validate_qr_image(value)
        validate_image_file(value)
        from common.utils import crop_qr_from_image
        return crop_qr_from_image(value)

    def validate_qr_name(self, value):
        value = validate_safe_name(value, field='QR name', max_length=100)
        qs = QRCode.objects.filter(qr_name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A QR code with this name already exists.')
        return value

    def validate_range_from(self, value):
        return validate_positive_amount(value, field='range_from')

    def validate_range_to(self, value):
        return validate_positive_amount(value, field='range_to')

    def validate_daily_limit(self, value):
        if value in (None, ''):
            return None
        return validate_positive_amount(value, field='Daily limit')

    def validate(self, attrs):
        _validate_range(attrs, self.instance)
        _validate_daily_limit(attrs, self.instance)
        return attrs

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


# ---------------------------------------------------------------------------
# UPI Source
# ---------------------------------------------------------------------------

class UPISourceSerializer(serializers.ModelSerializer):
    brand_name      = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = UPISource
        fields = [
            'id', 'brand', 'brand_name', 'upi_id',
            'range_from', 'range_to', 'daily_limit', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_brand_name(self, obj) -> str:
        return obj.brand.name if obj.brand else None

    def get_created_by_name(self, obj) -> str:
        return obj.created_by.username if obj.created_by else None

    def validate_upi_id(self, value):
        value = validate_upi_vpa(value)
        qs = UPISource.objects.filter(upi_id__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A UPI source with this UPI ID already exists.')
        return value

    def validate_range_from(self, value):
        return validate_positive_amount(value, field='range_from')

    def validate_range_to(self, value):
        return validate_positive_amount(value, field='range_to')

    def validate_daily_limit(self, value):
        if value in (None, ''):
            return None
        return validate_positive_amount(value, field='Daily limit')

    def validate(self, attrs):
        _validate_range(attrs, self.instance)
        _validate_daily_limit(attrs, self.instance)
        return attrs

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


# ---------------------------------------------------------------------------
# Bank Account
# ---------------------------------------------------------------------------

class BankAccountSerializer(serializers.ModelSerializer):
    brand_name      = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = BankAccount
        fields = [
            'id', 'brand', 'brand_name',
            'bank_name', 'account_holder_name', 'account_number',
            'ifsc_code', 'branch_name',
            'range_from', 'range_to', 'daily_limit', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_brand_name(self, obj) -> str:
        return obj.brand.name if obj.brand else None

    def get_created_by_name(self, obj) -> str:
        return obj.created_by.username if obj.created_by else None

    def validate_bank_name(self, value):
        return validate_safe_name(value, field='Bank name', max_length=100)

    def validate_account_holder_name(self, value):
        return validate_safe_name(value, field='Account holder name', max_length=150)

    def validate_branch_name(self, value):
        return validate_safe_name(value, field='Branch name', max_length=100)

    def validate_account_number(self, value):
        value = validate_account_number(value)
        qs = BankAccount.objects.filter(account_number=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A bank account with this account number already exists.')
        return value

    def validate_ifsc_code(self, value):
        return validate_ifsc(value)

    def validate_range_from(self, value):
        return validate_positive_amount(value, field='range_from')

    def validate_range_to(self, value):
        return validate_positive_amount(value, field='range_to')

    def validate_daily_limit(self, value):
        if value in (None, ''):
            return None
        return validate_positive_amount(value, field='Daily limit')

    def validate(self, attrs):
        _validate_range(attrs, self.instance)
        _validate_daily_limit(attrs, self.instance)
        return attrs

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
