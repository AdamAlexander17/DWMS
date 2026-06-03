from django.db import transaction

from .models import Brand


class BrandService:
    """Business logic for Brand management."""

    @staticmethod
    @transaction.atomic
    def create(name: str) -> Brand:
        name = name.upper().strip()
        if Brand.objects.filter(name=name).exists():
            raise ValueError(f"Brand '{name}' already exists")
        return Brand.objects.create(name=name)

    @staticmethod
    @transaction.atomic
    def update(brand: Brand, name: str) -> Brand:
        name = name.upper().strip()
        if Brand.objects.filter(name=name).exclude(pk=brand.pk).exists():
            raise ValueError(f"Brand '{name}' already exists")
        brand.name = name
        brand.save(update_fields=['name', 'updated_at'])
        return brand

    @staticmethod
    def activate(brand: Brand) -> Brand:
        brand.is_active = True
        brand.save(update_fields=['is_active', 'updated_at'])
        return brand

    @staticmethod
    def deactivate(brand: Brand) -> Brand:
        brand.is_active = False
        brand.save(update_fields=['is_active', 'updated_at'])
        return brand
