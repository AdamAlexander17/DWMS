import django.db.models.deletion
from django.db import migrations, models


def migrate_role_to_fk(apps, schema_editor):
    """Map the old role string to the corresponding Role FK."""
    User = apps.get_model('accounts', 'User')
    Role = apps.get_model('roles', 'Role')

    role_cache = {r.name: r for r in Role.objects.all()}

    for user in User.objects.all():
        old_name = user.role_old or 'rm'
        role_obj = role_cache.get(old_name)
        if role_obj:
            user.role = role_obj
            user.save(update_fields=['role'])


def reverse_fk_to_role(apps, schema_editor):
    """Restore the old role string from the FK (for migration reversal)."""
    User = apps.get_model('accounts', 'User')

    for user in User.objects.select_related('role').all():
        user.role_old = user.role.name if user.role else 'rm'
        user.save(update_fields=['role_old'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('roles',    '0002_default_roles'),
    ]

    operations = [
        # 1. Drop compound indexes that reference the old CharField 'role'
        migrations.RemoveIndex(model_name='user', name='users_role_a8f2ba_idx'),
        migrations.RemoveIndex(model_name='user', name='users_brand_i_a43315_idx'),

        # 2. Rename old 'role' CharField → 'role_old' (preserves the data)
        migrations.RenameField(model_name='user', old_name='role', new_name='role_old'),

        # 3. Add new nullable FK 'role'
        migrations.AddField(
            model_name='user',
            name='role',
            field=models.ForeignKey(
                'roles.Role',
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
                related_name='users',
                db_index=True,
            ),
        ),

        # 4. Data migration: populate FK from old string
        migrations.RunPython(migrate_role_to_fk, reverse_fk_to_role),

        # 5. Remove the old string field
        migrations.RemoveField(model_name='user', name='role_old'),

        # 6. Restore compound indexes on the new FK field
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['role', 'is_active'], name='users_role_a8f2ba_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['brand', 'role'], name='users_brand_i_a43315_idx'),
        ),
    ]
