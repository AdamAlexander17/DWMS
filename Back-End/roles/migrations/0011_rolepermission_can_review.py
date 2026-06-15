from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('roles', '0010_alter_rolepermission_module'),
    ]

    operations = [
        migrations.AddField(
            model_name='rolepermission',
            name='can_review',
            field=models.BooleanField(default=False),
        ),
    ]
