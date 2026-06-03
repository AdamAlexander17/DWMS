from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


# ---------------------------------------------------------------------------
# Auth serializers
# ---------------------------------------------------------------------------

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

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
    old_password     = serializers.CharField(write_only=True)
    new_password     = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError(
                {'confirm_password': 'Passwords do not match'}
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
            'id', 'username', 'mobile',
            'role', 'role_detail', 'brands', 'brands_detail', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'username', 'mobile',
            'role', 'role_detail', 'brands', 'brands_detail', 'is_active',
            'created_at', 'updated_at',
        ]
