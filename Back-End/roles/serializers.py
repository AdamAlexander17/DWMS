from rest_framework import serializers

from common.validators import validate_role_name, validate_text

from .models import Module, Role, RolePermission


class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = RolePermission
        fields = ['id', 'module', 'can_view', 'can_create', 'can_edit', 'can_delete', 'can_activate',
                  'can_review', 'can_complete',
                  'can_upload_slip', 'can_confirm_received', 'can_not_received',
                  'can_email_bank', 'can_close_ticket', 'can_chat', 'can_view_details']


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
        value = validate_role_name(value)
        qs = Role.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('A role with this name already exists.')
        return value

    def validate_description(self, value):
        return validate_text(value, field='Description', max_length=500, allow_blank=True)

    def validate_permissions(self, value):
        # Reject duplicate modules in a single payload
        seen = set()
        for perm in value or []:
            mod = perm.get('module')
            if mod is None:
                continue
            key = getattr(mod, 'pk', mod)
            if key in seen:
                raise serializers.ValidationError(
                    f'Duplicate permission entry for module id {key}.'
                )
            seen.add(key)
        return value

    def validate(self, attrs):
        # System roles cannot be deactivated
        is_active = attrs.get('is_active', getattr(self.instance, 'is_active', True))
        if self.instance and self.instance.is_system and is_active is False:
            raise serializers.ValidationError(
                {'is_active': 'System roles cannot be deactivated.'}
            )
        return attrs

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
            total += sum([
                p.can_view, p.can_create, p.can_edit, p.can_delete, p.can_activate,
                p.can_review, p.can_complete, p.can_upload_slip, p.can_confirm_received,
                p.can_not_received, p.can_email_bank, p.can_close_ticket, p.can_chat,
                p.can_view_details,
            ])
        return total

    class Meta:
        model  = Role
        fields = ['id', 'name', 'description', 'is_active', 'is_system',
                  'permissions_count', 'created_at', 'updated_at']
