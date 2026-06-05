from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from drf_spectacular.utils import extend_schema, extend_schema_view

from audit_logs.services import AuditLogService
from common.permissions import IsAdminOrBackOfficeOrRMReadOnly
from common.responses import error_response, success_response
from common.utils import get_client_ip

from .filters import BankAccountFilter, QRCodeFilter, UPISourceFilter
from .models import BankAccount, QRCode, UPISource
from .serializers import BankAccountSerializer, QRCodeSerializer, UPISourceSerializer


# ---------------------------------------------------------------------------
# Mixin: shared ViewSet logic for all payment source types
# ---------------------------------------------------------------------------

class _PaymentSourceMixin:
    """
    Provides common list / retrieve / create / update / destroy / activate /
    deactivate behaviour.  Concrete ViewSets set `log_module` and the DRF
    attributes (queryset, serializer_class, filterset_class, etc.).
    """

    log_module: str = 'PaymentSource'

    # ------------------------------------------------------------------
    # Queryset filtering: RM can only see active records for their brand
    # ------------------------------------------------------------------
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role_name = getattr(user.role, 'name', None) if getattr(user, 'role', None) else None
        if role_name == 'rm':
            # RM: only active channels belonging to their assigned brands
            qs = qs.filter(brand__in=user.brands.all(), is_active=True)
        elif role_name == 'back_office':
            # Back office: all channels (active + inactive) for their assigned brands
            qs = qs.filter(brand__in=user.brands.all())
        # admin: no brand restriction — sees everything
        return qs

    # ------------------------------------------------------------------
    # Standard CRUD
    # ------------------------------------------------------------------
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return success_response('Records fetched successfully', serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return success_response('Record fetched successfully', self.get_serializer(instance).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        AuditLogService.log(
            user=request.user,
            action=f'Created {self.log_module}',
            module=self.log_module,
            new_data=self.get_serializer(instance).data,
            ip_address=get_client_ip(request),
        )
        return success_response(
            f'{self.log_module} created successfully',
            self.get_serializer(instance).data,
            status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        old_data = self.get_serializer(instance).data
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        AuditLogService.log(
            user=request.user,
            action=f'Updated {self.log_module}',
            module=self.log_module,
            old_data=dict(old_data),
            new_data=self.get_serializer(instance).data,
            ip_address=get_client_ip(request),
        )
        return success_response(f'{self.log_module} updated successfully', self.get_serializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        old_data = self.get_serializer(instance).data
        AuditLogService.log(
            user=request.user,
            action=f'Deleted {self.log_module}',
            module=self.log_module,
            old_data=dict(old_data),
            ip_address=get_client_ip(request),
        )
        instance.delete()
        return success_response(f'{self.log_module} deleted successfully', status_code=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Activate / Deactivate
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        instance = self.get_object()
        if instance.is_active:
            return error_response(f'{self.log_module} is already active')
        instance.is_active = True
        instance.save(update_fields=['is_active', 'updated_at'])
        AuditLogService.log(
            user=request.user,
            action=f'Activated {self.log_module}',
            module=self.log_module,
            new_data={'id': instance.id, 'is_active': True},
            ip_address=get_client_ip(request),
        )
        return success_response(f'{self.log_module} activated successfully', self.get_serializer(instance).data)

    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        instance = self.get_object()
        if not instance.is_active:
            return error_response(f'{self.log_module} is already inactive')
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])
        AuditLogService.log(
            user=request.user,
            action=f'Deactivated {self.log_module}',
            module=self.log_module,
            new_data={'id': instance.id, 'is_active': False},
            ip_address=get_client_ip(request),
        )
        return success_response(f'{self.log_module} deactivated successfully', self.get_serializer(instance).data)


# ---------------------------------------------------------------------------
# Concrete ViewSets
# ---------------------------------------------------------------------------

@extend_schema_view(
    list=extend_schema(summary='List QR codes', tags=['QR Codes']),
    retrieve=extend_schema(summary='Get QR code', tags=['QR Codes']),
    create=extend_schema(summary='Upload a QR code', tags=['QR Codes']),
    update=extend_schema(summary='Update QR code', tags=['QR Codes']),
    partial_update=extend_schema(summary='Partially update QR code', tags=['QR Codes']),
    destroy=extend_schema(summary='Delete QR code', tags=['QR Codes']),
    activate=extend_schema(summary='Activate QR code', tags=['QR Codes'], request=None),
    deactivate=extend_schema(summary='Deactivate QR code', tags=['QR Codes'], request=None),
)
class QRCodeViewSet(_PaymentSourceMixin, ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminOrBackOfficeOrRMReadOnly]
    queryset = QRCode.objects.select_related('brand', 'created_by').all()
    serializer_class = QRCodeSerializer
    filterset_class = QRCodeFilter
    search_fields = ['qr_name']
    ordering_fields = ['created_at', 'qr_name', 'range_from', 'range_to', 'is_active']
    log_module = 'QR Code'


@extend_schema_view(
    list=extend_schema(summary='List UPI sources', tags=['UPI Sources']),
    retrieve=extend_schema(summary='Get UPI source', tags=['UPI Sources']),
    create=extend_schema(summary='Create UPI source', tags=['UPI Sources']),
    update=extend_schema(summary='Update UPI source', tags=['UPI Sources']),
    partial_update=extend_schema(summary='Partially update UPI source', tags=['UPI Sources']),
    destroy=extend_schema(summary='Delete UPI source', tags=['UPI Sources']),
    activate=extend_schema(summary='Activate UPI source', tags=['UPI Sources'], request=None),
    deactivate=extend_schema(summary='Deactivate UPI source', tags=['UPI Sources'], request=None),
)
class UPISourceViewSet(_PaymentSourceMixin, ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminOrBackOfficeOrRMReadOnly]
    queryset = UPISource.objects.select_related('brand', 'created_by').all()
    serializer_class = UPISourceSerializer
    filterset_class = UPISourceFilter
    search_fields = ['upi_id']
    ordering_fields = ['created_at', 'upi_id', 'range_from', 'range_to', 'is_active']
    log_module = 'UPI'


@extend_schema_view(
    list=extend_schema(summary='List bank accounts', tags=['Bank Accounts']),
    retrieve=extend_schema(summary='Get bank account', tags=['Bank Accounts']),
    create=extend_schema(summary='Create bank account', tags=['Bank Accounts']),
    update=extend_schema(summary='Update bank account', tags=['Bank Accounts']),
    partial_update=extend_schema(summary='Partially update bank account', tags=['Bank Accounts']),
    destroy=extend_schema(summary='Delete bank account', tags=['Bank Accounts']),
    activate=extend_schema(summary='Activate bank account', tags=['Bank Accounts'], request=None),
    deactivate=extend_schema(summary='Deactivate bank account', tags=['Bank Accounts'], request=None),
)
class BankAccountViewSet(_PaymentSourceMixin, ModelViewSet):
    permission_classes = [IsAuthenticated, IsAdminOrBackOfficeOrRMReadOnly]
    queryset = BankAccount.objects.select_related('brand', 'created_by').all()
    serializer_class = BankAccountSerializer
    filterset_class = BankAccountFilter
    search_fields = ['bank_name', 'account_holder_name', 'ifsc_code']
    ordering_fields = ['created_at', 'bank_name', 'range_from', 'range_to', 'is_active']
    log_module = 'Bank Account'
