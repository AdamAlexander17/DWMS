from rest_framework import serializers

from .models import Module, Role, RolePermission


class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = RolePermission
        fields = ['id', 'module', 'can_view', 'can_create', 'can_edit', 'can_delete', 'can_activate']


class RoleSerializer(serializers.ModelSerializer):
    permissions = RolePermissionSerializer(many=True, required=False)

    class Meta:
        model  = Role
        fields = [
            'id', 'name', 'description', 'is_active', 'is_system',
            'permissions', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'is_system', 'created_at', 'updated_at']

    def validate_name(self, value):
        qs = Role.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A role with this name already exists.')
        return value

    def create(self, validated_data):
        permissions_data = validated_data.pop('permissions', [])
        role = Role.objects.create(**validated_data)
        for perm in permissions_data:
            RolePermission.objects.create(role=role, **perm)
        return role

    def update(self, instance, validated_data):
        permissions_data = validated_data.pop('permissions', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if permissions_data is not None:
            instance.permissions.all().delete()
            for perm in permissions_data:
                RolePermission.objects.create(role=instance, **perm)
        return instance


class RoleListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views and dropdowns."""
    permissions_count = serializers.SerializerMethodField()

    def get_permissions_count(self, obj):
        """Total number of enabled permission actions across all modules."""
        total = 0
        for p in obj.permissions.all():
            total += sum([p.can_view, p.can_create, p.can_edit, p.can_delete, p.can_activate])
        return total

    class Meta:
        model  = Role
        fields = ['id', 'name', 'description', 'is_active', 'is_system',
                  'permissions_count', 'created_at', 'updated_at']
