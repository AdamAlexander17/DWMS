from django.db import models


class Gateway(models.Model):
    """Master list of payment gateways (e.g. PG1, PG2, PG3 …)."""

    name = models.CharField(max_length=50, unique=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'gateways'
        ordering = ['name']

    def __str__(self) -> str:
        return self.name
