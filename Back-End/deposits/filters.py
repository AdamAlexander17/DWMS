import django_filters

from .models import DepositLog


class DepositLogFilter(django_filters.FilterSet):
    brand        = django_filters.NumberFilter(field_name='brand_id')
    channel_type = django_filters.CharFilter()
    channel_id   = django_filters.NumberFilter()
    deposit_from = django_filters.DateFilter(field_name='deposit_at', lookup_expr='date__gte')
    deposit_to   = django_filters.DateFilter(field_name='deposit_at', lookup_expr='date__lte')
    amount_min   = django_filters.NumberFilter(field_name='amount', lookup_expr='gte')
    amount_max   = django_filters.NumberFilter(field_name='amount', lookup_expr='lte')

    class Meta:
        model  = DepositLog
        fields = ['brand', 'channel_type', 'channel_id']
