from django.db import models


class Brand(models.Model):
    """Represents a business brand (e.g. TK, TB, BFX)."""

    name = models.CharField(max_length=50, unique=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'brands'
        ordering = ['name']

    def __str__(self) -> str:
        return self.name
