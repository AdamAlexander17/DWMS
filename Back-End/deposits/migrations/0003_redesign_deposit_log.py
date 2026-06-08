"""
Migration 0003 – Redesign DepositLog

Removes the old channel/brand/client/amount/UTR/deposit_at/remarks fields
and replaces them with:
  - gateway_name  (PG1 / PG2)
  - slip          (FileField, nullable)
  - slip_status   (added / not_received / pending)
  - comment       (TextField)
  - updated_at    (auto_now)

Also drops the ChannelNotification table entirely.
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('deposits', '0002_depositlog_review_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ------------------------------------------------------------------
        # 1. Drop ChannelNotification table
        # ------------------------------------------------------------------
        migrations.DeleteModel(
            name='ChannelNotification',
        ),

        # ------------------------------------------------------------------
        # 2. Remove old DepositLog fields
        # ------------------------------------------------------------------
        migrations.RemoveField(model_name='depositlog', name='channel_type'),
        migrations.RemoveField(model_name='depositlog', name='channel_id'),
        migrations.RemoveField(model_name='depositlog', name='brand'),
        migrations.RemoveField(model_name='depositlog', name='client_name'),
        migrations.RemoveField(model_name='depositlog', name='amount'),
        migrations.RemoveField(model_name='depositlog', name='utr_number'),
        migrations.RemoveField(model_name='depositlog', name='deposit_at'),
        migrations.RemoveField(model_name='depositlog', name='remarks'),

        # ------------------------------------------------------------------
        # 3. Add new fields
        # ------------------------------------------------------------------
        migrations.AddField(
            model_name='depositlog',
            name='gateway_name',
            field=models.CharField(
                choices=[('PG1', 'PG1'), ('PG2', 'PG2')],
                max_length=10,
                db_index=True,
                default='PG1',
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='depositlog',
            name='slip',
            field=models.FileField(blank=True, null=True, upload_to='deposit_slips/'),
        ),
        migrations.AddField(
            model_name='depositlog',
            name='slip_status',
            field=models.CharField(
                choices=[
                    ('added', 'Added'),
                    ('not_received', 'Not Received'),
                    ('pending', 'Pending'),
                ],
                default='pending',
                max_length=20,
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name='depositlog',
            name='comment',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='depositlog',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),

        # ------------------------------------------------------------------
        # 4. Update indexes
        # ------------------------------------------------------------------
        migrations.AddIndex(
            model_name='depositlog',
            index=models.Index(
                fields=['gateway_name', 'slip_status'],
                name='deposit_gateway_slip_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='depositlog',
            index=models.Index(
                fields=['status', 'created_at'],
                name='deposit_status_created_idx',
            ),
        ),
    ]
