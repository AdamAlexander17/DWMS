from django.conf import settings
from django.db import models


def withdrawal_attachment_upload_path(instance, filename):
    import uuid, os
    ext = os.path.splitext(filename)[1].lower() or '.bin'
    return f'withdrawal_attachments/{uuid.uuid4().hex}{ext}'

# Backward-compat alias (referenced by 0001_initial migration)
withdrawal_qr_upload_path = withdrawal_attachment_upload_path


class Withdrawal(models.Model):
    STATUS_CHOICES = [
        ('pending',  'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    # ── Client info ────────────────────────────────────────────────────────
    client_arc_id = models.CharField(max_length=100)
    client_name   = models.CharField(max_length=150)
    amount        = models.DecimalField(max_digits=12, decimal_places=2)

    # ── Withdrawal details ─────────────────────────────────────────────────
    withdrawal_datetime = models.DateTimeField(null=True, blank=True)
    attachment          = models.FileField(upload_to=withdrawal_attachment_upload_path, null=True, blank=True)
    comment             = models.TextField(blank=True)

    # ── Status / review ────────────────────────────────────────────────────
    status         = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', db_index=True)
    review_message = models.TextField(blank=True)

    # ── Audit ──────────────────────────────────────────────────────────────
    brand = models.ForeignKey(
        'brands.Brand',
        on_delete=models.PROTECT,
        related_name='withdrawals',
        db_index=True,
        null=True, blank=True,
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submitted_withdrawals',
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reviewed_withdrawals',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'withdrawals'
        ordering = ['-created_at']

    def __str__(self):
        return f'Withdrawal #{self.pk} — {self.client_name} ₹{self.amount}'
