"""
Seed deposit_history and withdrawal_history permissions for existing system roles.
Admin and back_office get full access; rm gets view-only.
"""
from django.db import migrations


def seed_history_permissions(apps, schema_editor):
    Role = apps.get_model('roles', 'Role')
    RolePermission = apps.get_model('roles', 'RolePermission')

    # Admin role — full access to history modules
    admin = Role.objects.filter(name='admin').first()
    if admin:
        for module in ('deposit_history', 'withdrawal_history'):
            RolePermission.objects.get_or_create(
                role=admin, module=module,
                defaults={
                    'can_view': True, 'can_create': True,
                    'can_edit': True, 'can_delete': True, 'can_activate': True,
                },
            )

    # Back office role — view access to history
    bo = Role.objects.filter(name='back_office').first()
    if bo:
        for module in ('deposit_history', 'withdrawal_history'):
            RolePermission.objects.get_or_create(
                role=bo, module=module,
                defaults={
                    'can_view': True, 'can_create': False,
                    'can_edit': False, 'can_delete': False, 'can_activate': False,
                },
            )

    # RM role — view access to history
    rm = Role.objects.filter(name='rm').first()
    if rm:
        for module in ('deposit_history', 'withdrawal_history'):
            RolePermission.objects.get_or_create(
                role=rm, module=module,
                defaults={
                    'can_view': True, 'can_create': False,
                    'can_edit': False, 'can_delete': False, 'can_activate': False,
                },
            )


def reverse(apps, schema_editor):
    RolePermission = apps.get_model('roles', 'RolePermission')
    RolePermission.objects.filter(module__in=('deposit_history', 'withdrawal_history')).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('roles', '0005_add_history_modules'),
    ]

    operations = [
        migrations.RunPython(seed_history_permissions, reverse),
    ]
