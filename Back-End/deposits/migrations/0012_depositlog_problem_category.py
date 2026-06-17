from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('deposits', '0011_depositactivity'),
    ]

    operations = [
        migrations.AddField(
            model_name='depositlog',
            name='problem_category',
            field=models.CharField(
                blank=True,
                choices=[
                    ('deposit_failed', 'Deposit Failed'),
                    ('amount_not_received', "Deposit Amount Didn't Receive"),
                ],
                db_index=True,
                default='',
                max_length=30,
            ),
        ),
    ]
