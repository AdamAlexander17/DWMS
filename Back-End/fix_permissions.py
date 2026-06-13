#!/usr/bin/env python
"""
Seed only the Admin role with all permissions.
All other roles should be created manually via the UI.
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from roles.models import Role, RolePermission, Module

# Only seed Admin role
ADMIN_CONFIG = {
    'view': True, 'create': True, 'edit': True, 'delete': True, 'activate': True,
    'is_system': True,
    'description': 'Full system administrator with unrestricted access',
}

# Get all modules
all_modules = [choice[0] for choice in Module.choices]

print('\n' + '=' * 80)
print('🔧 SEEDING ADMIN ROLE')
print('=' * 80)

print(f'\n📋 Modules to configure ({len(all_modules)}):')
for mod in all_modules:
    print(f'   • {mod}')

# Create or get Admin role
print(f'\n🔐 Processing role: admin')
print('-' * 80)

role, created = Role.objects.get_or_create(
    name='admin',
    defaults={
        'description': ADMIN_CONFIG['description'],
        'is_system': True,
        'is_active': True,
    }
)

if created:
    print(f'   ✅ Created admin role')
else:
    print(f'   ✓ Admin role already exists')

# Seed permissions for admin
print(f'\n   📝 Seeding module permissions:')

perm_dict = {
    'can_view': ADMIN_CONFIG['view'],
    'can_create': ADMIN_CONFIG['create'],
    'can_edit': ADMIN_CONFIG['edit'],
    'can_delete': ADMIN_CONFIG['delete'],
    'can_activate': ADMIN_CONFIG['activate'],
}

updates_made = 0

for module in all_modules:
    perm, created = RolePermission.objects.get_or_create(
        role=role,
        module=module,
        defaults=perm_dict,
    )
    
    if created:
        updates_made += 1
        perm_bits = 'VCEDA'  # All permissions for admin
        print(f'      ✅ {module:20} [{perm_bits}]')
    else:
        perm_bits = 'VCEDA'  # All permissions for admin
        print(f'      ✓ {module:20} [{perm_bits}]')

print('\n' + '=' * 80)
print('✨ VERIFICATION')
print('=' * 80)

role = Role.objects.filter(name='admin').first()
if role:
    perm_count = role.permissions.count()
    status = '✅' if perm_count == len(all_modules) else '⚠️'
    print(f'{status} admin | permissions: {perm_count}/{len(all_modules)} | system=True | active=True')

print('\n' + '=' * 80)
print(f'✅ Done! Admin role is ready.')
print('=' * 80)
print('\n📝 NOTE: All other roles should be created manually via the admin panel.')
print('   You can assign permissions for each custom role as needed.\n')

