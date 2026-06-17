import django.db.models.deletion
import deposits.models
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deposits', '0012_depositlog_problem_category'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DepositMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sender_role', models.CharField(blank=True, max_length=30)),
                ('message', models.TextField(blank=True)),
                ('attachment', models.FileField(blank=True, null=True, upload_to=deposits.models.deposit_message_upload_path)),
                ('attachment_name', models.CharField(blank=True, max_length=255)),
                ('is_protected', models.BooleanField(default=False)),
                ('password_hint', models.CharField(blank=True, max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('deposit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='deposits.depositlog')),
                ('sender', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deposit_messages', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'deposit_messages',
                'ordering': ['created_at'],
                'indexes': [models.Index(fields=['deposit', 'created_at'], name='deposit_msg_deposit_created_idx')],
            },
        ),
    ]
