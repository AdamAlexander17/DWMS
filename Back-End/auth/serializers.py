from django.contrib.auth.password_validation import validate_password as dj_validate_password
from rest_framework import serializers

from common.validators import validate_password_strength

from .models import User


# ---------------------------------------------------------------------------
# Auth serializers
# ---------------------------------------------------------------------------

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=50, trim_whitespace=True)
    password = serializers.CharField(write_only=True, max_length=128)

    def validate_username(self, value: str) -> str:
        v = (value or '').strip()
        if not v:
            raise serializers.ValidationError('Username is required.')
        return v

    def validate_password(self, value: str) -> str:
        if not value:
            raise serializers.ValidationError('Password is required.')
        return value

    def validate(self, attrs):
        from django.contrib.auth import authenticate
        user = authenticate(
            username=attrs['username'],
            password=attrs['password'],
        )
        if not user:
            raise serializers.ValidationError('Invalid username or password')
        if not user.is_active:
            raise serializers.ValidationError('This account has been deactivated')
        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password     = serializers.CharField(write_only=True, max_length=128)
    new_password     = serializers.CharField(write_only=True, max_length=128)
    confirm_password = serializers.CharField(write_only=True, max_length=128)

    def validate_new_password(self, value):
        validate_password_strength(value)
        dj_validate_password(value)
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError(
                {'confirm_password': 'Passwords do not match'}
            )
        if attrs.get('old_password') and attrs['old_password'] == attrs['new_password']:
            raise serializers.ValidationError(
                {'new_password': 'New password must be different from the old password.'}
            )
        return attrs


# ---------------------------------------------------------------------------
# Profile serializer
# ---------------------------------------------------------------------------

class _BrandBriefSerializer(serializers.Serializer):
    id   = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)


class _RoleBriefSerializer(serializers.Serializer):
    id   = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)


class ProfileSerializer(serializers.ModelSerializer):
    brands_detail = _BrandBriefSerializer(source='brands', many=True, read_only=True)
    role_detail   = _RoleBriefSerializer(source='role', read_only=True)
    role          = serializers.SerializerMethodField()
    brands        = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    def get_role(self, obj):
        return obj.role.name if obj.role_id else None

    class Meta:
        model = User
        fields = [
            'id', 'username',
            'role', 'role_detail', 'brands', 'brands_detail', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'username',
            'role', 'role_detail', 'brands', 'brands_detail', 'is_active',
            'created_at', 'updated_at',
        ]
