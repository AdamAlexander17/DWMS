import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id',          models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name',        models.CharField(db_index=True, max_length=50, unique=True)),
                ('description', models.TextField(blank=True, default='')),
                ('is_active',   models.BooleanField(db_index=True, default=True)),
                ('is_system',   models.BooleanField(default=False)),
                ('created_at',  models.DateTimeField(auto_now_add=True)),
                ('updated_at',  models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'roles',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='RolePermission',
            fields=[
                ('id',           models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('module',       models.CharField(
                    max_length=50,
                    choices=[
                        ('users',         'Users'),
                        ('brands',        'Brands'),
                        ('qr_codes',      'QR Codes'),
                        ('upi_sources',   'UPI Sources'),
                        ('bank_accounts', 'Bank Accounts'),
                        ('audit_logs',    'Audit Logs'),
                    ],
                )),
                ('can_view',     models.BooleanField(default=False)),
                ('can_create',   models.BooleanField(default=False)),
                ('can_edit',     models.BooleanField(default=False)),
                ('can_delete',   models.BooleanField(default=False)),
                ('can_activate', models.BooleanField(default=False)),
                ('role',         models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='permissions',
                    to='roles.role',
                )),
            ],
            options={
                'db_table': 'role_permissions',
                'ordering': ['module'],
                'unique_together': {('role', 'module')},
            },
        ),
    ]
