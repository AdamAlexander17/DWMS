from django.db import migrations

MODULES = ['users', 'brands', 'qr_codes', 'upi_sources', 'bank_accounts', 'audit_logs']

_ALL = dict(can_view=True, can_create=True, can_edit=True, can_delete=True, can_activate=True)
_BO  = dict(can_view=True, can_create=True, can_edit=True, can_delete=False, can_activate=True)
_RO  = dict(can_view=True, can_create=False, can_edit=False, can_delete=False, can_activate=False)

DEFAULT_ROLES = [
    {
        'name':        'admin',
        'description': 'Full system administrator with unrestricted access',
        'is_system':   True,
        'permissions': {m: _ALL for m in MODULES},
    },
    {
        'name':        'back_office',
        'description': 'Back-office staff — manages payment records',
        'is_system':   True,
        'permissions': {
            'qr_codes':      _BO,
            'upi_sources':   _BO,
            'bank_accounts': _BO,
        },
    },
    {
        'name':        'rm',
        'description': 'Relationship Manager — read-only access to payment records',
        'is_system':   True,
        'permissions': {
            'qr_codes':      _RO,
            'upi_sources':   _RO,
            'bank_accounts': _RO,
        },
    },
]


def seed_default_roles(apps, schema_editor):
    Role           = apps.get_model('roles', 'Role')
    RolePermission = apps.get_model('roles', 'RolePermission')

    for role_data in DEFAULT_ROLES:
        role, _ = Role.objects.get_or_create(
            name=role_data['name'],
            defaults={
                'description': role_data['description'],
                'is_system':   role_data['is_system'],
                'is_active':   True,
            },
        )
        for module, perms in role_data['permissions'].items():
            RolePermission.objects.get_or_create(
                role=role,
                module=module,
                defaults=perms,
            )


def reverse_seed(apps, schema_editor):
    Role = apps.get_model('roles', 'Role')
    Role.objects.filter(name__in=['admin', 'back_office', 'rm']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('roles', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_default_roles, reverse_seed),
    ]
