from django.contrib import admin

from .models import DepositLog


@admin.register(DepositLog)
class DepositLogAdmin(admin.ModelAdmin):
    list_display  = ['id', 'gateway_name', 'channel_type', 'slip_status', 'status', 'submitted_by', 'created_at']
    list_filter   = ['gateway_name', 'channel_type', 'slip_status', 'status']
    search_fields = ['comment', 'submitted_by__username']
    readonly_fields = ['submitted_by', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at']
    ordering      = ['-created_at']
