"""
Management command to seed ALL permissions for ALL roles and modules.
This ensures that the permission system works dynamically and comprehensively.

Usage:
    python manage.py seed_all_permissions [--dry-run]
"""

from django.core.management.base import BaseCommand, CommandError
from roles.models import Role, RolePermission, Module


class Command(BaseCommand):
    help = 'Seed all permissions for all roles and modules'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be seeded without actually saving to the database',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)

        self.stdout.write(self.style.HTTP_INFO('🔄 Starting permission seeding...'))

        # Define permission patterns for each role
        permission_matrix = {
            'admin': {
                # Admin can do everything
                'view': True, 'create': True, 'edit': True, 'delete': True, 'activate': True,
            },
            'back_office': {
                # BackOffice can create, edit, activate (no delete)
                'view': True, 'create': True, 'edit': True, 'delete': False, 'activate': True,
            },
            'rm': {
                # RM (Relationship Manager) has read-only access
                'view': True, 'create': False, 'edit': False, 'delete': False, 'activate': False,
            },
        }

        # Get all modules from the Module enum
        all_modules = [choice[0] for choice in Module.choices]

        self.stdout.write(f'\n📋 Found {len(all_modules)} modules:')
        for module in all_modules:
            self.stdout.write(f'   • {module}')

        # Seed permissions
        created_count = 0
        updated_count = 0

        for role_name, perms_config in permission_matrix.items():
            role = Role.objects.filter(name=role_name).first()
            if not role:
                self.stdout.write(
                    self.style.WARNING(f'⚠️  Role "{role_name}" not found, skipping')
                )
                continue

            self.stdout.write(f'\n🔐 Seeding permissions for role: {role_name}')

            for module in all_modules:
                perm_dict = {
                    'can_view': perms_config.get('view', False),
                    'can_create': perms_config.get('create', False),
                    'can_edit': perms_config.get('edit', False),
                    'can_delete': perms_config.get('delete', False),
                    'can_activate': perms_config.get('activate', False),
                }

                perm_obj, created = RolePermission.objects.get_or_create(
                    role=role,
                    module=module,
                    defaults=perm_dict,
                )

                if created:
                    created_count += 1
                    action_str = ' ✅ Created'
                else:
                    # Update existing permission if values differ
                    changed = False
                    for key, val in perm_dict.items():
                        if getattr(perm_obj, key) != val:
                            setattr(perm_obj, key, val)
                            changed = True

                    if changed and not dry_run:
                        perm_obj.save()
                        updated_count += 1
                        action_str = ' 🔄 Updated'
                    elif changed:
                        updated_count += 1
                        action_str = ' 🔄 Would update'
                    else:
                        action_str = ' ✓ Already set'

                # Pretty print permission bits
                perm_bits = ''.join([
                    'V' if perm_dict['can_view'] else '-',
                    'C' if perm_dict['can_create'] else '-',
                    'E' if perm_dict['can_edit'] else '-',
                    'D' if perm_dict['can_delete'] else '-',
                    'A' if perm_dict['can_activate'] else '-',
                ])

                self.stdout.write(f'   {module:20} [{perm_bits}]{action_str}')

        self.stdout.write('\n' + self.style.SUCCESS('✨ Permission seeding complete!'))
        self.stdout.write(
            self.style.HTTP_SUCCESS(
                f'\n📊 Summary: {created_count} created, {updated_count} updated/would-update'
            )
        )

        if dry_run:
            self.stdout.write(self.style.WARNING('\n⚠️  DRY RUN MODE — No changes were saved to the database'))
            self.stdout.write('Run without --dry-run to apply changes')
        else:
            self.stdout.write(self.style.SUCCESS('\n✅ All changes saved to the database'))

            # Verify permissions were set
            self.stdout.write('\n🔍 Verifying seeded permissions:')
            for role_name in permission_matrix.keys():
                role = Role.objects.filter(name=role_name).first()
                if role:
                    perm_count = role.permissions.count()
                    self.stdout.write(f'   • {role_name:15} has {perm_count} module permissions')
