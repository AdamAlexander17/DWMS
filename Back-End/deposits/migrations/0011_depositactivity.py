"""
Migration 0011 – Create DepositActivity model for timeline tracking.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deposits', '0010_depositlog_ark_id'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DepositActivity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[
                    ('created', 'Created'),
                    ('updated', 'Updated'),
                    ('reviewed', 'Reviewed'),
                    ('slip_uploaded', 'Slip Uploaded'),
                    ('status_change', 'Status Change'),
                ], max_length=30)),
                ('message', models.TextField(blank=True, default='')),
                ('slip_url', models.URLField(blank=True, default='')),
                ('extra', models.JSONField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('deposit', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='activities',
                    to='deposits.depositlog',
                )),
                ('actor', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='deposit_activities',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'deposit_activities',
                'ordering': ['-created_at'],
            },
        ),
    ]
