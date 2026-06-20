"""
Step 3: Remove the old brand FK columns now that data lives in the M2M tables.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0007_copy_brand_fk_to_m2m'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='bankaccount',
            name='brand',
        ),
        migrations.RemoveField(
            model_name='qrcode',
            name='brand',
        ),
        migrations.RemoveField(
            model_name='upisource',
            name='brand',
        ),
    ]
