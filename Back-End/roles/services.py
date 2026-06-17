from django.db import transaction

from .models import Module, Role, RolePermission


class RoleService:
    ALL_MODULES = [m.value for m in Module]

    @staticmethod
    @transaction.atomic
    def create_with_permissions(data: dict, permissions_data: list) -> Role:
        role = Role.objects.create(**data)
        for perm in permissions_data:
            RolePermission.objects.create(role=role, **perm)
        return role

    @staticmethod
    @transaction.atomic
    def replace_permissions(role: Role, permissions_data: list) -> Role:
        """Delete all existing permissions and replace with the provided list."""
        role.permissions.all().delete()
        for perm in permissions_data:
            RolePermission.objects.create(role=role, **perm)
        return role

    @staticmethod
    def full_permission_matrix(role: Role) -> list:
        """
        Return a list of permission objects for every module.
        Modules with no explicit entry are returned with all-False defaults.
        """
        existing = {p.module: p for p in role.permissions.all()}
        result = []
        for module in RoleService.ALL_MODULES:
            if module in existing:
                p = existing[module]
                result.append({
                    'module':      p.module,
                    'can_view':    p.can_view,
                    'can_create':  p.can_create,
                    'can_edit':    p.can_edit,
                    'can_delete':  p.can_delete,
                    'can_activate': p.can_activate,
                    'can_review':  p.can_review,
                    'can_complete': p.can_complete,
                    'can_chat':    p.can_chat,
                })
            else:
                result.append({
                    'module':      module,
                    'can_view':    False,
                    'can_create':  False,
                    'can_edit':    False,
                    'can_delete':  False,
                    'can_activate': False,
                    'can_review':  False,
                    'can_complete': False,
                    'can_chat':    False,
                })
        return result
