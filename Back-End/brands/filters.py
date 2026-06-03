import django_filters

from .models import Brand


class BrandFilter(django_filters.FilterSet):
    name = django_filters.CharFilter(lookup_expr='icontains')
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = Brand
        fields = ['name', 'is_active']
