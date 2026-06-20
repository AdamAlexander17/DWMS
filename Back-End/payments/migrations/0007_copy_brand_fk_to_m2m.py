"""
Step 2: Data migration — copy existing brand_id FK values into the new M2M tables.
"""

from django.db import migrations


def copy_brand_to_m2m(apps, schema_editor):
    """For each payment source row that has a brand_id, add it to the M2M."""
    QRCode = apps.get_model('payments', 'QRCode')
    UPISource = apps.get_model('payments', 'UPISource')
    BankAccount = apps.get_model('payments', 'BankAccount')

    for qr in QRCode.objects.filter(brand__isnull=False).iterator():
        qr.brands.add(qr.brand_id)

    for upi in UPISource.objects.filter(brand__isnull=False).iterator():
        upi.brands.add(upi.brand_id)

    for ba in BankAccount.objects.filter(brand__isnull=False).iterator():
        ba.brands.add(ba.brand_id)


def copy_m2m_to_brand(apps, schema_editor):
    """Reverse: take the first brand from M2M and write it back to the FK."""
    QRCode = apps.get_model('payments', 'QRCode')
    UPISource = apps.get_model('payments', 'UPISource')
    BankAccount = apps.get_model('payments', 'BankAccount')

    for qr in QRCode.objects.all().iterator():
        first = qr.brands.first()
        if first:
            qr.brand_id = first.id
            qr.save(update_fields=['brand_id'])

    for upi in UPISource.objects.all().iterator():
        first = upi.brands.first()
        if first:
            upi.brand_id = first.id
            upi.save(update_fields=['brand_id'])

    for ba in BankAccount.objects.all().iterator():
        first = ba.brands.first()
        if first:
            ba.brand_id = first.id
            ba.save(update_fields=['brand_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('payments', '0006_brand_fk_to_m2m'),
    ]

    operations = [
        migrations.RunPython(copy_brand_to_m2m, copy_m2m_to_brand),
    ]
