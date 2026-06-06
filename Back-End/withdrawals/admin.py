from django.contrib import admin
from .models import Withdrawal


@admin.register(Withdrawal)
class WithdrawalAdmin(admin.ModelAdmin):
    list_display  = ['id', 'client_name', 'client_arc_id', 'amount', 'status', 'submitted_by', 'brand', 'created_at']
    list_filter   = ['status', 'brand']
    search_fields = ['client_name', 'client_arc_id', 'submitted_by__username']
    readonly_fields = ['submitted_by', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at']
