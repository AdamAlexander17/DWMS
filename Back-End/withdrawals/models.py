from django.conf import settings
from django.db import models


# Kept for migration compatibility only
def withdrawal_attachment_upload_path(instance, filename):
    import uuid, os
    ext = os.path.splitext(filename)[1].lower() or '.bin'
    return f'withdrawal_attachments/{uuid.uuid4().hex}{ext}'

withdrawal_qr_upload_path = withdrawal_attachment_upload_path


def withdrawal_slip_upload_path(instance, filename):
    import uuid, os
    ext = os.path.splitext(filename)[1].lower() or '.bin'
    return f'withdrawal_slips/{uuid.uuid4().hex}{ext}'


def withdrawal_message_upload_path(instance, filename):
    import uuid, os
    ext = os.path.splitext(filename)[1].lower() or '.bin'
    return f'withdrawal_messages/{uuid.uuid4().hex}{ext}'


class Withdrawal(models.Model):
    STATUS_CHOICES = [
        ('pending',                'Pending'),
        ('slip_uploaded',          'Slip Uploaded'),
        ('bank_followup_required', 'Bank Follow-Up Required'),
        ('email_sent_to_bank',     'Email Sent to Bank'),
        ('closed',                 'Closed'),
        # legacy values kept so existing rows still work
        ('approved',               'Approved'),
        ('rejected',               'Rejected'),
    ]

    # ── Client info ────────────────────────────────────────────────────────
    client_arc_id = models.CharField(max_length=100)
    client_name   = models.CharField(max_length=150)
    amount        = models.DecimalField(max_digits=12, decimal_places=2)

    # ── Withdrawal details ─────────────────────────────────────────────────
    withdrawal_datetime = models.DateTimeField(null=True, blank=True)
    comment             = models.TextField(blank=True)

    # ── Status ────────────────────────────────────────────────────────────
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending', db_index=True)

    # ── Back Office: slip upload ───────────────────────────────────────────
    slip             = models.FileField(upload_to=withdrawal_slip_upload_path, null=True, blank=True)
    slip_note        = models.TextField(blank=True)
    slip_uploaded_at = models.DateTimeField(null=True, blank=True)
    slip_uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_slips',
    )

    # ── RM: client follow-up (didn't receive funds) ────────────────────────
    followup_remarks = models.TextField(blank=True)

    # ── Back Office: bank follow-up ────────────────────────────────────────
    bank_followup_note = models.TextField(blank=True)
    email_sent_at      = models.DateTimeField(null=True, blank=True)

    # ── Legacy review fields ───────────────────────────────────────────────
    review_message = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_withdrawals',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # ── Audit ──────────────────────────────────────────────────────────────
    brand = models.ForeignKey(
        'brands.Brand',
        on_delete=models.PROTECT, related_name='withdrawals',
        db_index=True, null=True, blank=True,
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submitted_withdrawals',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'withdrawals'
        ordering = ['-created_at']

    def __str__(self):
        return f'Withdrawal #{self.pk} — {self.client_name} ₹{self.amount}'


class WithdrawalNotification(models.Model):
    TYPE_CHOICES = [
        ('slip_uploaded',      'Slip Uploaded'),
        ('followup_required',  'Follow-Up Required'),
        ('email_sent_to_bank', 'Email Sent to Bank'),
        ('closed',             'Ticket Closed'),
        ('new_message',        'New Message'),
        ('manual_closed',      'Manually Closed'),
    ]

    withdrawal = models.ForeignKey(
        Withdrawal, on_delete=models.CASCADE,
        related_name='notifications',
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='withdrawal_notifications',
    )
    notif_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    message    = models.TextField()
    is_read    = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'withdrawal_notifications'
        ordering = ['-created_at']

    def __str__(self):
        return f'WD Notif {self.notif_type} → {self.recipient}'


class WithdrawalMessage(models.Model):
    """Free-form chat between RM and Back Office on a withdrawal ticket."""
    withdrawal = models.ForeignKey(
        Withdrawal, on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name='withdrawal_messages',
    )
    sender_role = models.CharField(max_length=30, blank=True)  # snapshot at send time
    message = models.TextField(blank=True)

    attachment          = models.FileField(upload_to=withdrawal_message_upload_path, null=True, blank=True)
    attachment_name     = models.CharField(max_length=255, blank=True)
    is_protected        = models.BooleanField(default=False)
    password_hint       = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'withdrawal_messages'
        ordering = ['created_at']
        indexes = [models.Index(fields=['withdrawal', 'created_at'])]

    def __str__(self):
        return f'Msg #{self.pk} on WD#{self.withdrawal_id} by {self.sender}'


class WithdrawalMessageRead(models.Model):
    """Tracks the last time each user read messages in a withdrawal chat."""
    withdrawal = models.ForeignKey(
        Withdrawal, on_delete=models.CASCADE,
        related_name='message_reads',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='withdrawal_message_reads',
    )
    last_read_at = models.DateTimeField()

    class Meta:
        db_table = 'withdrawal_message_reads'
        unique_together = ('withdrawal', 'user')
        indexes = [models.Index(fields=['withdrawal', 'user'])]

    def __str__(self):
        return f'User {self.user_id} read WD#{self.withdrawal_id} at {self.last_read_at}'
