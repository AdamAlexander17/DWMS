from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('roles', '0011_rolepermission_can_review'),
    ]

    operations = [
        migrations.AddField(
            model_name='rolepermission',
            name='can_complete',
            field=models.BooleanField(default=False),
        ),
    ]
