from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_remove_full_name_email'),
        ('brands', '0001_initial'),
    ]

    operations = [
        # Drop the composite index that referenced the old brand FK column
        migrations.RemoveIndex(
            model_name='user',
            name='users_brand_i_a43315_idx',
        ),
        # Drop the old FK column
        migrations.RemoveField(
            model_name='user',
            name='brand',
        ),
        # Create the new M2M junction table
        migrations.AddField(
            model_name='user',
            name='brands',
            field=models.ManyToManyField(
                blank=True,
                db_table='user_brands',
                related_name='users',
                to='brands.Brand',
            ),
        ),
    ]
