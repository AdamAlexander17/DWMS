import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deposits', '0013_depositmessage'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DepositMessageRead',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('last_read_at', models.DateTimeField()),
                ('deposit', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='message_reads', to='deposits.depositlog')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='deposit_message_reads', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'deposit_message_reads',
                'unique_together': {('deposit', 'user')},
            },
        ),
    ]
