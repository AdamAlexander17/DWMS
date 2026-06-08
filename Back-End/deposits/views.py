from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import (
    CreateModelMixin, DestroyModelMixin,
    ListModelMixin, RetrieveModelMixin, UpdateModelMixin,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet

from common.pagination import StandardResultsPagination
from common.permissions import IsAdminOrBackOffice, IsRM
from common.responses import success_response

from .filters import DepositLogFilter
from .models import DepositLog
from .serializers import DepositLogSerializer


@extend_schema_view(
    list=extend_schema(summary='List deposit logs', tags=['Deposits']),
    retrieve=extend_schema(summary='Get deposit log', tags=['Deposits']),
    create=extend_schema(summary='Log a deposit (RM only)', tags=['Deposits']),
    update=extend_schema(summary='Update a deposit log', tags=['Deposits']),
    partial_update=extend_schema(summary='Partially update a deposit log', tags=['Deposits']),
    destroy=extend_schema(summary='Delete a deposit log', tags=['Deposits']),
)
class DepositLogViewSet(
    CreateModelMixin, UpdateModelMixin, DestroyModelMixin,
    ListModelMixin, RetrieveModelMixin, GenericViewSet,
):
    serializer_class = DepositLogSerializer
    pagination_class = StandardResultsPagination
    filterset_class  = DepositLogFilter
    ordering_fields  = ['created_at', 'gateway_name', 'slip_status', 'status']
    search_fields    = ['comment']

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsRM()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return DepositLog.objects.select_related(
            'submitted_by', 'reviewed_by',
            'qr_code', 'upi_source', 'bank_account',
        ).all()

    # ------------------------------------------------------------------
    # Standard actions
    # ------------------------------------------------------------------

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return success_response('Deposit logs fetched successfully', serializer.data)

    def retrieve(self, request, *args, **kwargs):
        return success_response(
            'Deposit log fetched successfully',
            self.get_serializer(self.get_object()).data,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return success_response(
            'Deposit logged successfully',
            self.get_serializer(instance).data,
            status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        return success_response('Deposit updated successfully', self.get_serializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return success_response('Deposit deleted successfully', status_code=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Review action — Admin / Back Office only
    # ------------------------------------------------------------------

    @extend_schema(summary='Approve or reject a deposit', tags=['Deposits'])
    @action(detail=True, methods=['post'], url_path='review')
    def review(self, request, pk=None):
        if not IsAdminOrBackOffice().has_permission(request, self):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only admin or back office can review deposits.')

        deposit    = self.get_object()
        action_val = request.data.get('action', '')
        message    = request.data.get('message', '').strip()

        if action_val not in (DepositLog.STATUS_APPROVED, DepositLog.STATUS_REJECTED):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'action': 'Must be "approved" or "rejected".'})

        deposit.status         = action_val
        deposit.review_message = message
        deposit.reviewed_by    = request.user
        deposit.reviewed_at    = timezone.now()
        deposit.save(update_fields=['status', 'review_message', 'reviewed_by', 'reviewed_at'])

        return success_response(
            f'Deposit {action_val} successfully.',
            self.get_serializer(deposit).data,
        )
