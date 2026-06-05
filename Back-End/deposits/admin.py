from django.contrib import admin

from .models import ChannelNotification, DepositLog


@admin.register(DepositLog)
class DepositLogAdmin(admin.ModelAdmin):
    list_display  = ['client_name', 'amount', 'utr_number', 'channel_type', 'channel_id', 'brand', 'submitted_by', 'deposit_at', 'created_at']
    list_filter   = ['channel_type', 'brand']
    search_fields = ['client_name', 'utr_number']
    ordering      = ['-created_at']


@admin.register(ChannelNotification)
class ChannelNotificationAdmin(admin.ModelAdmin):
    list_display  = ['channel_label', 'channel_type', 'level', 'percent_used', 'brand', 'is_read', 'created_at']
    list_filter   = ['level', 'is_read', 'brand']
    ordering      = ['-created_at']
