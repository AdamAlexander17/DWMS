from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_user_role_fk'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='full_name',
        ),
        migrations.RemoveField(
            model_name='user',
            name='email',
        ),
    ]
