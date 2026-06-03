from django.conf import settings
from django.db import models

from common.utils import generate_qr_upload_path


class PaymentSource(models.Model):
    """
    Abstract base model shared by QRCode, UPISource, and BankAccount.
    Provides brand association, amount range, audit fields, and status.
    """

    brand = models.ForeignKey(
        'brands.Brand',
        on_delete=models.PROTECT,
        related_name='%(class)s_sources',
        db_index=True,
    )
    range_from = models.DecimalField(max_digits=15, decimal_places=2)
    range_to = models.DecimalField(max_digits=15, decimal_places=2)
    is_active = models.BooleanField(default=True, db_index=True)
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

    qr_name = models.CharField(max_length=100)
    qr_image = models.FileField(upload_to=generate_qr_upload_path)

    class Meta(PaymentSource.Meta):
        db_table = 'qr_codes'
        indexes = [
            models.Index(fields=['brand', 'is_active']),
        ]

    def __str__(self) -> str:
        return f'{self.qr_name} ({self.brand})'


class UPISource(PaymentSource):
    """UPI ID payment source."""

    upi_id = models.CharField(max_length=100)

    class Meta(PaymentSource.Meta):
        db_table = 'upi_sources'
        indexes = [
            models.Index(fields=['brand', 'is_active']),
        ]

    def __str__(self) -> str:
        return f'{self.upi_id} ({self.brand})'


class BankAccount(PaymentSource):
    """Bank account payment source."""

    bank_name = models.CharField(max_length=100)
    account_holder_name = models.CharField(max_length=150)
    account_number = models.CharField(max_length=30)
    ifsc_code = models.CharField(max_length=20)
    branch_name = models.CharField(max_length=100)

    class Meta(PaymentSource.Meta):
        db_table = 'bank_accounts'
        indexes = [
            models.Index(fields=['brand', 'is_active']),
        ]

    def __str__(self) -> str:
        return f'{self.bank_name} – {self.account_holder_name} ({self.brand})'
