from rest_framework import serializers

from brands.models import Brand
from brands.serializers import BrandSerializer
from common.file_validators import validate_qr_image as fv_validate_qr_image
from common.utils import validate_image_file
from common.validators import (
    validate_account_number,
    validate_ifsc,
    validate_positive_amount,
    validate_range,
    validate_safe_name,
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


def _validate_brands_scope(brands, request):
    """Users with 'all' scope or superusers can use any brand. Others must be assigned."""
    if not brands or request is None:
        return
    from common.permissions import is_admin_user, resolve_module_scope
    user = getattr(request, 'user', None)
    if is_admin_user(user):
        return
    if resolve_module_scope(user) == 'all':
        return
    allowed_ids = set(user.brands.values_list('id', flat=True))
    for brand in brands:
        if brand.id not in allowed_ids:
            raise serializers.ValidationError(
                {'brands': f'You are not assigned to brand "{brand.name}".'}
            )


# ---------------------------------------------------------------------------
# QR Code
# ---------------------------------------------------------------------------

class QRCodeSerializer(serializers.ModelSerializer):
    # Read: nested brand objects
    brands_detail = BrandSerializer(source='brands', many=True, read_only=True)
    # Write: list of brand IDs
    brands = serializers.PrimaryKeyRelatedField(
        queryset=Brand.objects.all(), many=True, required=True,
    )
    brand_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = QRCode
        fields = [
            'id', 'brands', 'brands_detail', 'brand_name', 'qr_name', 'qr_image',
            'range_from', 'range_to', 'daily_limit', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_brand_name(self, obj) -> str:
        """Comma-separated brand names for backward-compatible display."""
        names = obj.brands.values_list('name', flat=True)
        return ', '.join(names) if names else None

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

    def validate_brands(self, value):
        if not value:
            raise serializers.ValidationError('At least one brand is required.')
        return value

    def validate(self, attrs):
        _validate_range(attrs, self.instance)
        _validate_daily_limit(attrs, self.instance)
        _validate_brands_scope(attrs.get('brands'), self.context.get('request'))
        return attrs

    def create(self, validated_data):
        brands = validated_data.pop('brands', [])
        validated_data['created_by'] = self.context['request'].user
        instance = super().create(validated_data)
        instance.brands.set(brands)
        return instance

    def update(self, instance, validated_data):
        brands = validated_data.pop('brands', None)
        instance = super().update(instance, validated_data)
        if brands is not None:
            instance.brands.set(brands)
        return instance


# ---------------------------------------------------------------------------
# UPI Source
# ---------------------------------------------------------------------------

class UPISourceSerializer(serializers.ModelSerializer):
    brands_detail = BrandSerializer(source='brands', many=True, read_only=True)
    brands = serializers.PrimaryKeyRelatedField(
        queryset=Brand.objects.all(), many=True, required=True,
    )
    brand_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = UPISource
        fields = [
            'id', 'brands', 'brands_detail', 'brand_name', 'upi_id',
            'range_from', 'range_to', 'daily_limit', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_brand_name(self, obj) -> str:
        names = obj.brands.values_list('name', flat=True)
        return ', '.join(names) if names else None

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

    def validate_brands(self, value):
        if not value:
            raise serializers.ValidationError('At least one brand is required.')
        return value

    def validate(self, attrs):
        _validate_range(attrs, self.instance)
        _validate_daily_limit(attrs, self.instance)
        _validate_brands_scope(attrs.get('brands'), self.context.get('request'))
        return attrs

    def create(self, validated_data):
        brands = validated_data.pop('brands', [])
        validated_data['created_by'] = self.context['request'].user
        instance = super().create(validated_data)
        instance.brands.set(brands)
        return instance

    def update(self, instance, validated_data):
        brands = validated_data.pop('brands', None)
        instance = super().update(instance, validated_data)
        if brands is not None:
            instance.brands.set(brands)
        return instance


# ---------------------------------------------------------------------------
# Bank Account
# ---------------------------------------------------------------------------

class BankAccountSerializer(serializers.ModelSerializer):
    brands_detail = BrandSerializer(source='brands', many=True, read_only=True)
    brands = serializers.PrimaryKeyRelatedField(
        queryset=Brand.objects.all(), many=True, required=True,
    )
    brand_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = BankAccount
        fields = [
            'id', 'brands', 'brands_detail', 'brand_name',
            'bank_name', 'account_holder_name', 'account_number',
            'ifsc_code', 'branch_name',
            'range_from', 'range_to', 'daily_limit', 'is_active',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
        extra_kwargs = {
            'branch_name': {'required': False, 'allow_blank': True},
        }

    def get_brand_name(self, obj) -> str:
        names = obj.brands.values_list('name', flat=True)
        return ', '.join(names) if names else None

    def get_created_by_name(self, obj) -> str:
        return obj.created_by.username if obj.created_by else None

    def validate_bank_name(self, value):
        return validate_safe_name(value, field='Bank name', max_length=100)

    def validate_account_holder_name(self, value):
        return validate_safe_name(value, field='Account holder name', max_length=150)

    def validate_branch_name(self, value):
        if not value or not value.strip():
            return ''
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

    def validate_brands(self, value):
        if not value:
            raise serializers.ValidationError('At least one brand is required.')
        return value

    def validate(self, attrs):
        _validate_range(attrs, self.instance)
        _validate_daily_limit(attrs, self.instance)
        _validate_brands_scope(attrs.get('brands'), self.context.get('request'))
        return attrs

    def create(self, validated_data):
        brands = validated_data.pop('brands', [])
        validated_data['created_by'] = self.context['request'].user
        instance = super().create(validated_data)
        instance.brands.set(brands)
        return instance

    def update(self, instance, validated_data):
        brands = validated_data.pop('brands', None)
        instance = super().update(instance, validated_data)
        if brands is not None:
            instance.brands.set(brands)
        return instance
