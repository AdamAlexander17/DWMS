import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deposits', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='depositlog',
            name='status',
            field=models.CharField(
                choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')],
                db_index=True, default='pending', max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='depositlog',
            name='review_message',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='depositlog',
            name='reviewed_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='reviewed_deposits',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='depositlog',
            name='reviewed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
