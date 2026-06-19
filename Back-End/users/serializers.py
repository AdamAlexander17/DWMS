from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password as dj_validate_password
from rest_framework import serializers

from brands.models import Brand
from common.validators import (
    validate_password_strength,
    validate_username,
)
from roles.models import Role

User = get_user_model()


class _BrandBriefSerializer(serializers.Serializer):
    id   = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)


class _RoleBriefSerializer(serializers.Serializer):
    id   = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)


class UserListSerializer(serializers.ModelSerializer):
    brands_detail = _BrandBriefSerializer(source='brands', many=True, read_only=True)
    role_detail   = _RoleBriefSerializer(source='role', read_only=True)
    role_name     = serializers.SerializerMethodField()
    brands        = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    def get_role_name(self, obj):
        return obj.role.name if obj.role_id else None

    class Meta:
        model  = User
        fields = [
            'id', 'username',
            'role', 'role_name', 'role_detail',
            'brands', 'brands_detail', 'is_active',
            'must_change_password',
            'last_login', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'must_change_password', 'last_login', 'created_at', 'updated_at']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, max_length=128)
    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.filter(is_active=True),
        allow_null=True,
        required=False,
    )
    brands = serializers.PrimaryKeyRelatedField(
        queryset=Brand.objects.all(),
        many=True,
        required=False,
    )

    class Meta:
        model  = User
        fields = ['username', 'role', 'brands', 'password']

    def validate_username(self, value):
        v = validate_username(value)
        if User.objects.filter(username__iexact=v).exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return v

    def validate_password(self, value):
        if not value or len(value) < 4:
            raise serializers.ValidationError('Password must be at least 4 characters long.')
        if ' ' in value:
            raise serializers.ValidationError('Password must not contain spaces.')
        return value

    def validate(self, attrs):
        role = attrs.get('role')
        # Roles with 'brand' scope require at least one brand assigned
        if role and getattr(role, 'scope', 'own') == 'brand' and not attrs.get('brands'):
            raise serializers.ValidationError(
                {'brands': 'Users with this role must be assigned to at least one brand.'}
            )
        return attrs

    def create(self, validated_data):
        brands   = validated_data.pop('brands', [])
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.must_change_password = True
        user.save()
        if brands:
            user.brands.set(brands)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.filter(is_active=True),
        allow_null=True,
        required=False,
    )
    brands = serializers.PrimaryKeyRelatedField(
        queryset=Brand.objects.all(),
        many=True,
        required=False,
    )

    class Meta:
        model  = User
        fields = ['username', 'role', 'brands']

    def validate_username(self, value):
        v = validate_username(value)
        qs = User.objects.filter(username__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A user with this username already exists.')
        return v

    def validate(self, attrs):
        role   = attrs.get('role', self.instance.role if self.instance else None)
        brands = attrs.get('brands', list(self.instance.brands.all()) if self.instance else [])
        # Roles with 'brand' scope require at least one brand assigned
        if role and getattr(role, 'scope', 'own') == 'brand' and not brands:
            raise serializers.ValidationError(
                {'brands': 'Users with this role must be assigned to at least one brand.'}
            )
        # Prevent admins from removing their own admin role / deactivating themselves
        request = self.context.get('request') if hasattr(self, 'context') else None
        if request and self.instance and request.user.pk == self.instance.pk:
            new_active = attrs.get('is_active', self.instance.is_active)
            if new_active is False:
                raise serializers.ValidationError(
                    {'is_active': "You cannot deactivate your own account."}
                )
            if role and role_name != (self.instance.role.name.lower() if self.instance.role_id else None):
                raise serializers.ValidationError(
                    {'role': "You cannot change your own role."}
                )
        return attrs

    def update(self, instance, validated_data):
        brands = validated_data.pop('brands', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if brands is not None:
            instance.brands.set(brands)
        return instance
