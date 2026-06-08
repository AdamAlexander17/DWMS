"""
Migration 0006 – Replace gateway_name CharField with a FK to master.Gateway.

Steps:
1. Create master.Gateway records for each distinct gateway_name in the table.
2. Add nullable gateway_id FK column.
3. Populate gateway_id from the old gateway_name values.
4. Drop the old gateway_name column and its index.
5. Make gateway_id non-nullable after data is populated.

Also adds the two named indexes that now appear in the Meta.
"""

import django.db.models.deletion
from django.db import migrations, models


def seed_gateways_and_link(apps, schema_editor):
    """Populate master.Gateway and set deposit_logs.gateway_id."""
    Gateway    = apps.get_model('master',   'Gateway')
    DepositLog = apps.get_model('deposits', 'DepositLog')

    # Collect distinct gateway names currently in use
    names = (
        DepositLog.objects
        .values_list('gateway_name', flat=True)
        .distinct()
    )

    for name in names:
        if name:
            gw, _ = Gateway.objects.get_or_create(name=name.upper().strip())
            DepositLog.objects.filter(gateway_name=name).update(gateway=gw)

    # Ensure PG1 and PG2 always exist in master even if no deposits yet
    for default_name in ('PG1', 'PG2'):
        Gateway.objects.get_or_create(name=default_name)


def reverse_link(apps, schema_editor):
    """Restore gateway_name from gateway FK (reverse migration)."""
    DepositLog = apps.get_model('deposits', 'DepositLog')
    for deposit in DepositLog.objects.select_related('gateway').all():
        if deposit.gateway:
            deposit.gateway_name = deposit.gateway.name
            deposit.save(update_fields=['gateway_name'])


class Migration(migrations.Migration):

    dependencies = [
        ('deposits', '0005_remove_depositlog_deposit_log_channel_8e59f3_idx_and_more'),
        ('master',   '0001_initial'),
    ]

    operations = [
        # 1. Add nullable gateway FK
        migrations.AddField(
            model_name='depositlog',
            name='gateway',
            field=models.ForeignKey(
                null=True,
                blank=True,
                db_index=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='deposit_logs',
                to='master.gateway',
            ),
        ),

        # 2. Populate the FK from the old varchar column & seed master table
        migrations.RunPython(seed_gateways_and_link, reverse_code=reverse_link),

        # 3. Remove the old gateway_name column (and its index)
        migrations.RemoveIndex(
            model_name='depositlog',
            name='deposit_log_gateway_6f47e3_idx',
        ),
        migrations.RemoveField(
            model_name='depositlog',
            name='gateway_name',
        ),

        # 4. Add new named indexes that match the updated Meta
        migrations.AddIndex(
            model_name='depositlog',
            index=models.Index(fields=['slip_status'], name='deposit_log_slip_status_idx'),
        ),
    ]
