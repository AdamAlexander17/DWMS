from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from audit_logs.services import AuditLogService
from common.pagination import StandardResultsPagination
from common.responses import error_response, success_response
from common.utils import get_client_ip

from .models import Withdrawal
from .serializers import WithdrawalReviewSerializer, WithdrawalSerializer


def _role(user) -> str:
    return (getattr(user.role, 'name', None) or '').lower()


class WithdrawalViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class   = WithdrawalSerializer
    pagination_class   = StandardResultsPagination
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        role = _role(user)
        qs   = Withdrawal.objects.select_related(
            'brand', 'submitted_by', 'reviewed_by'
        )
        if role == 'rm':
            return qs.filter(submitted_by=user)
        if role == 'back_office':
            return qs.filter(brand__in=user.brands.all())
        # admin — sees all
        return qs

    # ── List ──────────────────────────────────────────────────────────────
    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())

        # optional status filter
        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(WithdrawalSerializer(page, many=True).data)
        return success_response('Withdrawals fetched', WithdrawalSerializer(qs, many=True).data)

    # ── Retrieve ──────────────────────────────────────────────────────────
    def retrieve(self, request, *args, **kwargs):
        return success_response('Withdrawal fetched', WithdrawalSerializer(self.get_object()).data)

    # ── Create (RM submits) ───────────────────────────────────────────────
    def create(self, request, *args, **kwargs):
        serializer = WithdrawalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Auto-set brand from submitting user's first assigned brand
        brand = request.user.brands.first()
        instance = serializer.save(submitted_by=request.user, brand=brand)
        AuditLogService.log(
            user=request.user,
            action='Submitted withdrawal request',
            module='Withdrawal',
            new_data={'id': instance.pk, 'client': instance.client_name, 'amount': str(instance.amount)},
            ip_address=get_client_ip(request),
        )
        return success_response(
            'Withdrawal request submitted successfully',
            WithdrawalSerializer(instance).data,
            status_code=status.HTTP_201_CREATED,
        )

    # ── Update / Partial update ───────────────────────────────────────────
    def update(self, request, *args, **kwargs):
        role = _role(request.user)
        instance = self.get_object()

        # Only RM who submitted it can edit, and only while pending
        if role == 'rm':
            if instance.submitted_by_id != request.user.pk:
                return error_response('Not allowed', status_code=status.HTTP_403_FORBIDDEN)
            if instance.status != 'pending':
                return error_response('Cannot edit a reviewed withdrawal', status_code=status.HTTP_400_BAD_REQUEST)

        partial = kwargs.pop('partial', False)
        serializer = WithdrawalSerializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        AuditLogService.log(
            user=request.user,
            action='Updated withdrawal request',
            module='Withdrawal',
            ip_address=get_client_ip(request),
        )
        return success_response('Withdrawal updated', WithdrawalSerializer(instance).data)

    # ── Delete ────────────────────────────────────────────────────────────
    def destroy(self, request, *args, **kwargs):
        role = _role(request.user)
        instance = self.get_object()
        if role == 'rm' and (instance.submitted_by_id != request.user.pk or instance.status != 'pending'):
            return error_response('Cannot delete this withdrawal', status_code=status.HTTP_403_FORBIDDEN)
        instance.delete()
        AuditLogService.log(
            user=request.user,
            action='Deleted withdrawal request',
            module='Withdrawal',
            ip_address=get_client_ip(request),
        )
        return success_response('Withdrawal deleted', status_code=status.HTTP_204_NO_CONTENT)

    # ── Review: approve / reject (Back Office / Admin) ────────────────────
    @action(detail=True, methods=['post'], url_path='review')
    def review(self, request, pk=None):
        role = _role(request.user)
        if role not in ('admin', 'back_office'):
            return error_response('Only Back Office or Admin can review withdrawals', status_code=status.HTTP_403_FORBIDDEN)

        instance = self.get_object()
        if instance.status != 'pending':
            return error_response('This withdrawal has already been reviewed', status_code=status.HTTP_400_BAD_REQUEST)

        serializer = WithdrawalReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        act = serializer.validated_data['action']
        msg = serializer.validated_data.get('review_message', '')

        instance.status         = 'approved' if act == 'approve' else 'rejected'
        instance.review_message = msg
        instance.reviewed_by    = request.user
        instance.reviewed_at    = timezone.now()
        instance.save(update_fields=['status', 'review_message', 'reviewed_by', 'reviewed_at', 'updated_at'])

        AuditLogService.log(
            user=request.user,
            action=f'Withdrawal {instance.status}: #{instance.pk} ({instance.client_name})',
            module='Withdrawal',
            ip_address=get_client_ip(request),
        )
        return success_response(
            f'Withdrawal {instance.status} successfully',
            WithdrawalSerializer(instance).data,
        )
