import django_filters

from .models import BankAccount, QRCode, UPISource


class _PaymentSourceFilter(django_filters.FilterSet):
    brand = django_filters.NumberFilter(field_name='brand_id')
    is_active = django_filters.BooleanFilter()
    range_from_min = django_filters.NumberFilter(field_name='range_from', lookup_expr='gte')
    range_from_max = django_filters.NumberFilter(field_name='range_from', lookup_expr='lte')
    range_to_min = django_filters.NumberFilter(field_name='range_to', lookup_expr='gte')
    range_to_max = django_filters.NumberFilter(field_name='range_to', lookup_expr='lte')


class QRCodeFilter(_PaymentSourceFilter):
    qr_name = django_filters.CharFilter(lookup_expr='icontains')

    class Meta:
        model = QRCode
        fields = ['brand', 'is_active', 'qr_name']


class UPISourceFilter(_PaymentSourceFilter):
    upi_id = django_filters.CharFilter(lookup_expr='icontains')

    class Meta:
        model = UPISource
        fields = ['brand', 'is_active', 'upi_id']


class BankAccountFilter(_PaymentSourceFilter):
    bank_name = django_filters.CharFilter(lookup_expr='icontains')
    account_holder_name = django_filters.CharFilter(lookup_expr='icontains')

    class Meta:
        model = BankAccount
        fields = ['brand', 'is_active', 'bank_name', 'account_holder_name']
