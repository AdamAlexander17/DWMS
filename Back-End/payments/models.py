from django.conf import settings
from django.db import models

from common.utils import generate_qr_upload_path


class PaymentSource(models.Model):
    """
    Abstract base model shared by QRCode, UPISource, and BankAccount.
    Provides amount range, audit fields, and status.
    Brand association is handled via M2M on each concrete model.
    """

    range_from  = models.DecimalField(max_digits=15, decimal_places=2)
    range_to    = models.DecimalField(max_digits=15, decimal_places=2)
    daily_limit = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    is_active   = models.BooleanField(default=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='%(class)s_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['-created_at']


class QRCode(PaymentSource):
    """QR Code payment source."""

    qr_name = models.CharField(max_length=100, unique=True)
    qr_image = models.FileField(upload_to=generate_qr_upload_path)
    brands = models.ManyToManyField(
        'brands.Brand',
        related_name='qr_code_sources',
        blank=True,
        db_table='qr_code_brands',
    )

    class Meta(PaymentSource.Meta):
        db_table = 'qr_codes'

    def __str__(self) -> str:
        brand_names = ', '.join(self.brands.values_list('name', flat=True)[:3])
        return f'{self.qr_name} ({brand_names})'


class UPISource(PaymentSource):
    """UPI ID payment source."""

    upi_id = models.CharField(max_length=100)
    brands = models.ManyToManyField(
        'brands.Brand',
        related_name='upi_sources',
        blank=True,
        db_table='upi_source_brands',
    )

    class Meta(PaymentSource.Meta):
        db_table = 'upi_sources'

    def __str__(self) -> str:
        brand_names = ', '.join(self.brands.values_list('name', flat=True)[:3])
        return f'{self.upi_id} ({brand_names})'


class BankAccount(PaymentSource):
    """Bank account payment source."""

    bank_name = models.CharField(max_length=100)
    account_holder_name = models.CharField(max_length=150)
    account_number = models.CharField(max_length=30)
    ifsc_code = models.CharField(max_length=20)
    branch_name = models.CharField(max_length=100, blank=True, default='')
    brands = models.ManyToManyField(
        'brands.Brand',
        related_name='bank_account_sources',
        blank=True,
        db_table='bank_account_brands',
    )

    class Meta(PaymentSource.Meta):
        db_table = 'bank_accounts'

    def __str__(self) -> str:
        brand_names = ', '.join(self.brands.values_list('name', flat=True)[:3])
        return f'{self.bank_name} – {self.account_holder_name} ({brand_names})'
