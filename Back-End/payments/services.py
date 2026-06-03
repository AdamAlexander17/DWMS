from django.db import transaction

from .models import BankAccount, QRCode, UPISource


class QRCodeService:
    @staticmethod
    @transaction.atomic
    def activate(instance: QRCode) -> QRCode:
        instance.is_active = True
        instance.save(update_fields=['is_active', 'updated_at'])
        return instance

    @staticmethod
    @transaction.atomic
    def deactivate(instance: QRCode) -> QRCode:
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])
        return instance


class UPISourceService:
    @staticmethod
    @transaction.atomic
    def activate(instance: UPISource) -> UPISource:
        instance.is_active = True
        instance.save(update_fields=['is_active', 'updated_at'])
        return instance

    @staticmethod
    @transaction.atomic
    def deactivate(instance: UPISource) -> UPISource:
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])
        return instance


class BankAccountService:
    @staticmethod
    @transaction.atomic
    def activate(instance: BankAccount) -> BankAccount:
        instance.is_active = True
        instance.save(update_fields=['is_active', 'updated_at'])
        return instance

    @staticmethod
    @transaction.atomic
    def deactivate(instance: BankAccount) -> BankAccount:
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])
        return instance
