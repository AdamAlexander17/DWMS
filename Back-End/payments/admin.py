from django.contrib import admin

from .models import BankAccount, QRCode, UPISource


@admin.register(QRCode)
class QRCodeAdmin(admin.ModelAdmin):
    list_display = ['qr_name', 'range_from', 'range_to', 'is_active', 'created_by', 'created_at']
    list_filter = ['is_active']
    search_fields = ['qr_name']
    ordering = ['-created_at']
    filter_horizontal = ['brands']


@admin.register(UPISource)
class UPISourceAdmin(admin.ModelAdmin):
    list_display = ['upi_id', 'range_from', 'range_to', 'is_active', 'created_by', 'created_at']
    list_filter = ['is_active']
    search_fields = ['upi_id']
    ordering = ['-created_at']
    filter_horizontal = ['brands']


@admin.register(BankAccount)
class BankAccountAdmin(admin.ModelAdmin):
    list_display = [
        'bank_name', 'account_holder_name',
        'range_from', 'range_to', 'is_active', 'created_by', 'created_at',
    ]
    list_filter = ['is_active']
    search_fields = ['bank_name', 'account_holder_name', 'account_number', 'ifsc_code']
    ordering = ['-created_at']
    filter_horizontal = ['brands']
