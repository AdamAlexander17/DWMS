from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from drf_spectacular.utils import extend_schema, extend_schema_view

from audit_logs.services import AuditLogService
from common.permissions import IsAdmin
from common.responses import error_response, success_response
from common.utils import get_client_ip

from .filters import BrandFilter
from .models import Brand
from .serializers import BrandSerializer, BrandWriteSerializer
from .services import BrandService


@extend_schema_view(
    list=extend_schema(summary='List all brands', tags=['Brands']),
    retrieve=extend_schema(summary='Get a brand by ID', tags=['Brands']),
    create=extend_schema(summary='Create a brand', tags=['Brands']),
    update=extend_schema(summary='Update a brand', tags=['Brands']),
    partial_update=extend_schema(summary='Partially update a brand', tags=['Brands']),
    destroy=extend_schema(summary='Delete a brand', tags=['Brands']),
    activate=extend_schema(summary='Activate a brand', tags=['Brands'], request=None),
    deactivate=extend_schema(summary='Deactivate a brand', tags=['Brands'], request=None),
)
class BrandViewSet(ModelViewSet):
    """
    Full CRUD for brands.  Write operations: Admin only.
    Read operations: all authenticated users (back office and RM need brand lists for dropdowns).
    """

    permission_classes = [IsAuthenticated, IsAdmin]
    queryset = Brand.objects.all()
    filterset_class = BrandFilter
    search_fields = ['name']
    ordering_fields = ['name', 'is_active', 'created_at']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdmin()]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return BrandWriteSerializer
        return BrandSerializer

    # ------------------------------------------------------------------
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = BrandSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return success_response('Brands fetched successfully', BrandSerializer(queryset, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return success_response('Brand fetched successfully', BrandSerializer(instance).data)

    # ------------------------------------------------------------------
    def create(self, request, *args, **kwargs):
        serializer = BrandWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            brand = BrandService.create(serializer.validated_data['name'])
        except ValueError as exc:
            return error_response(str(exc))
        AuditLogService.log(
            user=request.user,
            action='Created brand',
            module='Brand',
            new_data={'name': brand.name},
            ip_address=get_client_ip(request),
        )
        return success_response('Brand created successfully', BrandSerializer(brand).data, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        old_data = BrandSerializer(instance).data
        serializer = BrandWriteSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        try:
            brand = BrandService.update(instance, serializer.validated_data['name'])
        except ValueError as exc:
            return error_response(str(exc))
        AuditLogService.log(
            user=request.user,
            action='Updated brand',
            module='Brand',
            old_data=dict(old_data),
            new_data=BrandSerializer(brand).data,
            ip_address=get_client_ip(request),
        )
        return success_response('Brand updated successfully', BrandSerializer(brand).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        AuditLogService.log(
            user=request.user,
            action='Deleted brand',
            module='Brand',
            old_data={'id': instance.id, 'name': instance.name},
            ip_address=get_client_ip(request),
        )
        instance.delete()
        return success_response('Brand deleted successfully', status_code=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        brand = self.get_object()
        if brand.is_active:
            return error_response('Brand is already active')
        BrandService.activate(brand)
        AuditLogService.log(
            user=request.user,
            action='Activated brand',
            module='Brand',
            new_data={'name': brand.name},
            ip_address=get_client_ip(request),
        )
        return success_response('Brand activated successfully', BrandSerializer(brand).data)

    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        brand = self.get_object()
        if not brand.is_active:
            return error_response('Brand is already inactive')
        BrandService.deactivate(brand)
        AuditLogService.log(
            user=request.user,
            action='Deactivated brand',
            module='Brand',
            new_data={'name': brand.name},
            ip_address=get_client_ip(request),
        )
        return success_response('Brand deactivated successfully', BrandSerializer(brand).data)
