from django.conf import settings
from django.db import models


class DepositLog(models.Model):
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
    STATUS_PENDING     = 'pending'
    STATUS_FOR_REVIEW  = 'for_review'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_COMPLETED   = 'completed'
    # Legacy — kept so existing rows stay valid
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES  = [
        (STATUS_PENDING,     'Pending'),
        (STATUS_FOR_REVIEW,  'For Review'),
        (STATUS_IN_PROGRESS, 'In Progress'),
        (STATUS_COMPLETED,   'Completed'),
        (STATUS_APPROVED,    'Approved'),
        (STATUS_REJECTED,    'Rejected'),
    ]

    # Gateway – driven from master.Gateway table
    gateway = models.ForeignKey(
        'master.Gateway',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        db_index=True,
        related_name='deposit_logs',
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
    ark_id = models.CharField(max_length=100, blank=True, default='')
    comment = models.TextField(blank=True, default='')

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='deposit_logs',
    )

    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    review_message = models.TextField(blank=True, default='')
    review_slip    = models.FileField(upload_to='deposit_review_slips/', null=True, blank=True)
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
            models.Index(fields=['slip_status'], name='deposit_log_slip_status_idx'),
            models.Index(fields=['status', 'created_at'], name='deposit_log_status_55fba1_idx'),
        ]

    def __str__(self) -> str:
        gw = self.gateway.name if self.gateway_id else '–'
        return f'{gw} – {self.slip_status} ({self.created_at:%Y-%m-%d})'


class DepositActivity(models.Model):
    """Immutable timeline entry for a deposit ticket — tracks every change."""

    ACTION_CREATED   = 'created'
    ACTION_UPDATED   = 'updated'
    ACTION_REVIEWED  = 'reviewed'
    ACTION_SLIP_UP   = 'slip_uploaded'
    ACTION_STATUS    = 'status_change'
    ACTION_CHOICES = [
        (ACTION_CREATED,  'Created'),
        (ACTION_UPDATED,  'Updated'),
        (ACTION_REVIEWED, 'Reviewed'),
        (ACTION_SLIP_UP,  'Slip Uploaded'),
        (ACTION_STATUS,   'Status Change'),
    ]

    deposit = models.ForeignKey(
        DepositLog,
        on_delete=models.CASCADE,
        related_name='activities',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='deposit_activities',
    )
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    message = models.TextField(blank=True, default='')
    slip_url = models.URLField(blank=True, default='')
    extra = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'deposit_activities'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.get_action_display()} by {self.actor} on deposit #{self.deposit_id}'


class DepositNotification(models.Model):
    """Notification for a deposit log recipient (e.g. review approved/rejected)."""

    LEVEL_WARNING  = 'warning'
    LEVEL_DANGER   = 'danger'
    LEVEL_EXHAUSTED = 'exhausted'
    LEVEL_INFO     = 'info'
    LEVEL_CHOICES  = [
        (LEVEL_WARNING,   'Warning'),
        (LEVEL_DANGER,    'Danger'),
        (LEVEL_EXHAUSTED, 'Exhausted'),
        (LEVEL_INFO,      'Info'),
    ]

    recipient     = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='deposit_notifications',
    )
    deposit_log   = models.ForeignKey(
        DepositLog,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='notifications',
    )
    level         = models.CharField(max_length=20, choices=LEVEL_CHOICES, default=LEVEL_INFO, db_index=True)
    channel_label = models.CharField(max_length=200, blank=True)
    message       = models.TextField(blank=True)
    percent_used  = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    is_read       = models.BooleanField(default=False, db_index=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'deposit_notifications'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'DepositNotif({self.level}) → {self.recipient}'
