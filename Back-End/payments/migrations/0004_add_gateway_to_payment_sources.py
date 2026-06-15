"""
Migration 0004 – Add gateway FK to QRCode, UPISource, and BankAccount.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0003_qrcode_unique_name'),
        ('master', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='qrcode',
            name='gateway',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='qrcode_sources',
                to='master.gateway',
            ),
        ),
        migrations.AddField(
            model_name='upisource',
            name='gateway',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='upisource_sources',
                to='master.gateway',
            ),
        ),
        migrations.AddField(
            model_name='bankaccount',
            name='gateway',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='bankaccount_sources',
                to='master.gateway',
            ),
        ),
    ]
