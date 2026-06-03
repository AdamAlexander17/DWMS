from django.contrib.auth import get_user_model
from rest_framework import serializers

from brands.models import Brand
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
            'id', 'username', 'mobile',
            'role', 'role_name', 'role_detail',
            'brands', 'brands_detail', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
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
        fields = [
            'username', 'role', 'brands', 'password',
        ]

    def validate(self, attrs):
        role      = attrs.get('role')
        role_name = role.name.lower() if role else None
        if role_name == 'rm' and not attrs.get('brands'):
            raise serializers.ValidationError(
                {'brands': 'RM users must be assigned to at least one brand'}
            )
        return attrs

    def create(self, validated_data):
        brands   = validated_data.pop('brands', [])
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
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
        fields = ['role', 'brands']

    def validate(self, attrs):
        role      = attrs.get('role', self.instance.role if self.instance else None)
        brands    = attrs.get('brands', list(self.instance.brands.all()) if self.instance else [])
        role_name = role.name.lower() if role else None
        if role_name == 'rm' and not brands:
            raise serializers.ValidationError(
                {'brands': 'RM users must be assigned to at least one brand'}
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
