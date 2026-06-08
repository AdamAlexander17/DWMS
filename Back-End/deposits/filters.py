import django_filters

from .models import DepositLog


class DepositLogFilter(django_filters.FilterSet):
    gateway_name = django_filters.ChoiceFilter(choices=DepositLog.GATEWAY_CHOICES)
    slip_status  = django_filters.ChoiceFilter(choices=DepositLog.SLIP_STATUS_CHOICES)
    status       = django_filters.ChoiceFilter(choices=DepositLog.STATUS_CHOICES)
    created_from = django_filters.DateFilter(field_name='created_at', lookup_expr='date__gte')
    created_to   = django_filters.DateFilter(field_name='created_at', lookup_expr='date__lte')

    class Meta:
        model  = DepositLog
        fields = ['gateway_name', 'slip_status', 'status']
