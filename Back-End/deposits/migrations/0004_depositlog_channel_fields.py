"""
Migration 0004 – Add channel_type, qr_code, upi_source, bank_account to DepositLog.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deposits', '0003_redesign_deposit_log'),
        ('payments', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='depositlog',
            name='channel_type',
            field=models.CharField(
                blank=True,
                choices=[
                    ('qr',   'QR Code'),
                    ('upi',  'UPI'),
                    ('bank', 'Bank Account'),
                ],
                db_index=True,
                max_length=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='depositlog',
            name='qr_code',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='deposit_logs',
                to='payments.qrcode',
            ),
        ),
        migrations.AddField(
            model_name='depositlog',
            name='upi_source',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='deposit_logs',
                to='payments.upisource',
            ),
        ),
        migrations.AddField(
            model_name='depositlog',
            name='bank_account',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='deposit_logs',
                to='payments.bankaccount',
            ),
        ),
    ]
