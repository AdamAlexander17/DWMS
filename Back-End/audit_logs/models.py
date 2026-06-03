from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """
    Immutable audit trail entry.
    Records who did what, to which module, from which IP, and when.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs',
    )
    action = models.CharField(max_length=200)
    module = models.CharField(max_length=50, db_index=True)
    old_data = models.JSONField(null=True, blank=True)
    new_data = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['module', 'timestamp']),
        ]

    def __str__(self) -> str:
        return f'{self.user} – {self.action} ({self.timestamp:%Y-%m-%d %H:%M})'
