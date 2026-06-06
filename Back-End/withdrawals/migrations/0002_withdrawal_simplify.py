import withdrawals.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('withdrawals', '0001_initial'),
    ]

    operations = [
        # Remove old fields
        migrations.RemoveField(model_name='withdrawal', name='client_mobile'),
        migrations.RemoveField(model_name='withdrawal', name='payment_method'),
        migrations.RemoveField(model_name='withdrawal', name='upi_id'),
        migrations.RemoveField(model_name='withdrawal', name='upi_qr_image'),
        migrations.RemoveField(model_name='withdrawal', name='bank_name'),
        migrations.RemoveField(model_name='withdrawal', name='account_holder_name'),
        migrations.RemoveField(model_name='withdrawal', name='account_number'),
        migrations.RemoveField(model_name='withdrawal', name='ifsc_code'),
        # Allow brand to be null (auto-set server-side, not required in form)
        migrations.AlterField(
            model_name='withdrawal',
            name='brand',
            field=models.ForeignKey(
                blank=True, db_index=True, null=True,
                on_delete=models.deletion.PROTECT,
                related_name='withdrawals', to='brands.brand',
            ),
        ),
        # Add new fields
        migrations.AddField(
            model_name='withdrawal',
            name='withdrawal_datetime',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='withdrawal',
            name='attachment',
            field=models.FileField(
                blank=True, null=True,
                upload_to=withdrawals.models.withdrawal_attachment_upload_path,
            ),
        ),
        migrations.AddField(
            model_name='withdrawal',
            name='comment',
            field=models.TextField(blank=True),
        ),
    ]
