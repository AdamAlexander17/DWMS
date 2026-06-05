from django.conf import settings
from django.db import models


class DepositLog(models.Model):
    CHANNEL_QR   = 'qr'
    CHANNEL_UPI  = 'upi'
    CHANNEL_BANK = 'bank'
    CHANNEL_CHOICES = [
        (CHANNEL_QR,   'QR Code'),
        (CHANNEL_UPI,  'UPI Source'),
        (CHANNEL_BANK, 'Bank Account'),
    ]

    channel_type = models.CharField(max_length=10, choices=CHANNEL_CHOICES, db_index=True)
    channel_id   = models.PositiveIntegerField(db_index=True)
    brand        = models.ForeignKey(
        'brands.Brand',
        on_delete=models.PROTECT,
        related_name='deposit_logs',
        db_index=True,
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='deposit_logs',
    )
    client_name = models.CharField(max_length=150)
    amount      = models.DecimalField(max_digits=15, decimal_places=2)
    utr_number  = models.CharField(max_length=50, db_index=True)
    deposit_at  = models.DateTimeField()
    remarks     = models.TextField(blank=True, default='')

    STATUS_PENDING  = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES  = [
        (STATUS_PENDING,  'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    review_message = models.TextField(blank=True, default='')
    reviewed_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reviewed_deposits',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'deposit_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['channel_type', 'channel_id']),
            models.Index(fields=['brand', 'deposit_at']),
        ]

    def __str__(self) -> str:
        return f'{self.client_name} – ₹{self.amount} via {self.channel_type}:{self.channel_id}'


class ChannelNotification(models.Model):
    LEVEL_WARNING   = 'warning'
    LEVEL_DANGER    = 'danger'
    LEVEL_EXHAUSTED = 'exhausted'
    LEVEL_CHOICES = [
        (LEVEL_WARNING,   'Warning (50%)'),
        (LEVEL_DANGER,    'Danger (80%)'),
        (LEVEL_EXHAUSTED, 'Exhausted (100%)'),
    ]

    channel_type  = models.CharField(max_length=10, db_index=True)
    channel_id    = models.PositiveIntegerField(db_index=True)
    channel_label = models.CharField(max_length=200)
    brand         = models.ForeignKey(
        'brands.Brand',
        on_delete=models.CASCADE,
        related_name='channel_notifications',
    )
    level        = models.CharField(max_length=20, choices=LEVEL_CHOICES, db_index=True)
    percent_used = models.DecimalField(max_digits=5, decimal_places=2)
    is_read      = models.BooleanField(default=False, db_index=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'channel_notifications'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_read', 'created_at']),
            models.Index(fields=['brand', 'is_read']),
        ]

    def __str__(self) -> str:
        return f'{self.channel_label} – {self.level} ({self.percent_used}%)'
