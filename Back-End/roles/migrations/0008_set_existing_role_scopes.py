"""Set scope values for existing roles based on their historical behavior."""
from django.db import migrations


def set_scopes(apps, schema_editor):
    Role = apps.get_model('roles', 'Role')

    # admin → all
    Role.objects.filter(name='admin').update(scope='all')

    # Back-Office → brand
    Role.objects.filter(name__iexact='back-office').update(scope='brand')
    Role.objects.filter(name__iexact='back_office').update(scope='brand')

    # RM → own
    Role.objects.filter(name__iexact='rm').update(scope='own')

    # Any other roles default to 'own' (already the model default)


def reverse(apps, schema_editor):
    pass  # No reverse needed — scope field will be removed on rollback


class Migration(migrations.Migration):
    dependencies = [
        ('roles', '0007_add_scope_field'),
    ]

    operations = [
        migrations.RunPython(set_scopes, reverse),
    ]
