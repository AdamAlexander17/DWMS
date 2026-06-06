from django.db import migrations, models
import django.db.models.deletion
import withdrawals.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('brands', '0001_initial'),
        ('accounts', '0005_user_must_change_password'),
    ]

    operations = [
        migrations.CreateModel(
            name='Withdrawal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('client_arc_id', models.CharField(max_length=100)),
                ('client_name', models.CharField(max_length=150)),
                ('client_mobile', models.CharField(blank=True, max_length=20)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('payment_method', models.CharField(choices=[('upi', 'UPI'), ('bank', 'Bank Transfer')], max_length=10)),
                ('upi_id', models.CharField(blank=True, max_length=150)),
                ('upi_qr_image', models.ImageField(blank=True, null=True, upload_to=withdrawals.models.withdrawal_qr_upload_path)),
                ('bank_name', models.CharField(blank=True, max_length=100)),
                ('account_holder_name', models.CharField(blank=True, max_length=150)),
                ('account_number', models.CharField(blank=True, max_length=30)),
                ('ifsc_code', models.CharField(blank=True, max_length=15)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], db_index=True, default='pending', max_length=10)),
                ('review_message', models.TextField(blank=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('brand', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='withdrawals', to='brands.brand')),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_withdrawals', to='accounts.user')),
                ('submitted_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='submitted_withdrawals', to='accounts.user')),
            ],
            options={
                'db_table': 'withdrawals',
                'ordering': ['-created_at'],
            },
        ),
    ]
