from django.db import transaction

from .models import Gateway


class GatewayService:
    """Business logic for Gateway master data."""

    @staticmethod
    @transaction.atomic
    def create(name: str) -> Gateway:
        name = name.upper().strip()
        # If an inactive gateway with this name exists, reactivate it
        existing = Gateway.objects.filter(name=name).first()
        if existing:
            if existing.is_active:
                raise ValueError(f"Gateway '{name}' already exists.")
            existing.is_active = True
            existing.save(update_fields=['is_active', 'updated_at'])
            return existing
        return Gateway.objects.create(name=name)

    @staticmethod
    @transaction.atomic
    def update(gateway: Gateway, name: str) -> Gateway:
        name = name.upper().strip()
        if Gateway.objects.filter(name=name).exclude(pk=gateway.pk).exists():
            raise ValueError(f"Gateway '{name}' already exists.")
        gateway.name = name
        gateway.save(update_fields=['name', 'updated_at'])
        return gateway

    @staticmethod
    def activate(gateway: Gateway) -> Gateway:
        gateway.is_active = True
        gateway.save(update_fields=['is_active', 'updated_at'])
        return gateway

    @staticmethod
    def deactivate(gateway: Gateway) -> Gateway:
        gateway.is_active = False
        gateway.save(update_fields=['is_active', 'updated_at'])
        return gateway
