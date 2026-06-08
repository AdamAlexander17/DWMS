from django.contrib import admin

from .models import Gateway


@admin.register(Gateway)
class GatewayAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'is_active', 'created_at', 'updated_at']
    list_filter  = ['is_active']
    search_fields = ['name']
    ordering = ['name']
