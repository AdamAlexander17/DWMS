from django.conf import settings
from django.db import models


class DepositLog(models.Model):
    # Gateway choices (dropdown)
    GATEWAY_PG1 = 'PG1'
    GATEWAY_PG2 = 'PG2'
    GATEWAY_CHOICES = [
        (GATEWAY_PG1, 'PG1'),
        (GATEWAY_PG2, 'PG2'),
    ]

    # Channel type choices
    CHANNEL_QR   = 'qr'
    CHANNEL_UPI  = 'upi'
    CHANNEL_BANK = 'bank'
    CHANNEL_TYPE_CHOICES = [
        (CHANNEL_QR,   'QR Code'),
        (CHANNEL_UPI,  'UPI'),
        (CHANNEL_BANK, 'Bank Account'),
    ]

    # Slip status choices
    SLIP_ADDED        = 'added'
    SLIP_NOT_RECEIVED = 'not_received'
    SLIP_PENDING      = 'pending'
    SLIP_STATUS_CHOICES = [
        (SLIP_ADDED,        'Added'),
        (SLIP_NOT_RECEIVED, 'Not Received'),
        (SLIP_PENDING,      'Pending'),
    ]

    # Review status choices
    STATUS_PENDING  = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES  = [
        (STATUS_PENDING,  'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    gateway_name = models.CharField(
        max_length=10,
        choices=GATEWAY_CHOICES,
        db_index=True,
    )

    # Channel type + polymorphic FKs (at most one is set at a time)
    channel_type = models.CharField(
        max_length=10,
        choices=CHANNEL_TYPE_CHOICES,
        null=True,
        blank=True,
        db_index=True,
    )
    qr_code = models.ForeignKey(
        'payments.QRCode',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='deposit_logs',
    )
    upi_source = models.ForeignKey(
        'payments.UPISource',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='deposit_logs',
    )
    bank_account = models.ForeignKey(
        'payments.BankAccount',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='deposit_logs',
    )

    slip = models.FileField(
        upload_to='deposit_slips/',
        null=True,
        blank=True,
    )
    slip_status = models.CharField(
        max_length=20,
        choices=SLIP_STATUS_CHOICES,
        default=SLIP_PENDING,
        db_index=True,
    )
    comment = models.TextField(blank=True, default='')

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='deposit_logs',
    )

    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    review_message = models.TextField(blank=True, default='')
    reviewed_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reviewed_deposits',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'deposit_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['gateway_name', 'slip_status']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self) -> str:
        return f'{self.gateway_name} – {self.slip_status} ({self.created_at:%Y-%m-%d})'
