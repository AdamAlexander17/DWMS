import django_filters

from .models import AuditLog


class AuditLogFilter(django_filters.FilterSet):
    module = django_filters.CharFilter(lookup_expr='icontains')
    action = django_filters.CharFilter(lookup_expr='icontains')
    user = django_filters.NumberFilter(field_name='user_id')
    from_date = django_filters.DateTimeFilter(field_name='timestamp', lookup_expr='gte')
    to_date = django_filters.DateTimeFilter(field_name='timestamp', lookup_expr='lte')

    class Meta:
        model = AuditLog
        fields = ['module', 'action', 'user', 'from_date', 'to_date']
