from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'module', 'ip_address', 'timestamp']
    list_filter = ['module', 'timestamp']
    search_fields = ['action', 'user__username', 'module']
    readonly_fields = ['user', 'action', 'module', 'old_data', 'new_data', 'ip_address', 'timestamp']
    ordering = ['-timestamp']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
