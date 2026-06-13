from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import (
    CreateModelMixin, DestroyModelMixin,
    ListModelMixin, RetrieveModelMixin, UpdateModelMixin,
)
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet
from django.db.models import Q

from common.pagination import StandardResultsPagination
from common.permissions import ModulePermission, resolve_module_scope, has_module_permission
from common.responses import success_response, error_response

from .filters import DepositLogFilter
from .models import DepositLog, DepositNotification, DepositActivity
from .serializers import DepositLogSerializer, DepositNotificationSerializer, DepositActivitySerializer
from .services import push_deposit_event


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
    ordering_fields  = ['created_at', 'gateway', 'slip_status', 'status']
    search_fields    = ['comment', 'ark_id', 'gateway__name', 'channel_type',
                        'qr_code__qr_name', 'upi_source__upi_id',
                        'bank_account__bank_name', 'bank_account__account_number']

    def get_permissions(self):
        action_map = {
            'list': 'view',
            'retrieve': 'view',
            'create': 'create',
            'update': 'edit',
            'partial_update': 'edit',
            'destroy': 'create',  # RM can delete own; method enforces ownership
            'review': 'edit',
        }
        return [IsAuthenticated(), ModulePermission('deposits', action_map.get(self.action, 'view'))()]

    def get_queryset(self):
        qs = DepositLog.objects.select_related(
            'submitted_by', 'reviewed_by', 'gateway',
            'qr_code', 'upi_source', 'bank_account',
        ).all()

        user = self.request.user
        scope = resolve_module_scope(user, 'deposits')

        if scope == 'all':
            return qs

        if scope == 'own':
            return qs.filter(submitted_by=user)

        if scope == 'brand':
            brand_scope = user.brands.all()
            return qs.filter(
                Q(submitted_by__brands__in=brand_scope)
            ).distinct()

        return qs.none()

    # ------------------------------------------------------------------
    # Standard actions
    # ------------------------------------------------------------------

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        # Deposit History requests ?status=completed — show completed deposits.
        is_history = request.query_params.get('status') == DepositLog.STATUS_COMPLETED

        # Default list excludes completed deposits (those live in Deposit History).
        if 'status' not in request.query_params:
            queryset = queryset.exclude(status=DepositLog.STATUS_COMPLETED)

        # History page: show completed
        if is_history:
            queryset = self.filter_queryset(self.get_queryset()).filter(
                status=DepositLog.STATUS_COMPLETED
            )

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
        try:
            push_deposit_event(instance, request.user, 'created')
        except Exception:
            pass

        # Log activity
        DepositActivity.objects.create(
            deposit=instance,
            actor=request.user,
            action=DepositActivity.ACTION_CREATED,
            message=f'Deposit created. Slip status: {instance.get_slip_status_display()}.',
            slip_url=instance.slip.url if instance.slip else '',
        )

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
        try:
            push_deposit_event(instance, request.user, 'updated')
        except Exception:
            pass

        # Log activity
        DepositActivity.objects.create(
            deposit=instance,
            actor=request.user,
            action=DepositActivity.ACTION_UPDATED,
            message=f'Deposit updated. Slip status: {instance.get_slip_status_display()}.',
            slip_url=instance.slip.url if instance.slip else '',
        )

        return success_response('Deposit updated successfully', self.get_serializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Users with delete permission can delete any deposit
        # Others can only delete their own
        if not has_module_permission(request.user, 'deposits', 'delete'):
            if instance.submitted_by_id != request.user.pk:
                return error_response('You can only delete your own deposits', status_code=status.HTTP_403_FORBIDDEN)
        instance.delete()
        return success_response('Deposit deleted successfully')

    # ------------------------------------------------------------------
    # Review action — Admin / Back Office only
    # ------------------------------------------------------------------

    @extend_schema(summary='Review a deposit (for_review / in_progress / completed)', tags=['Deposits'])
    @action(detail=True, methods=['post'], url_path='review',
            parser_classes=[MultiPartParser, FormParser, JSONParser])
    def review(self, request, pk=None):
        if not has_module_permission(request.user, 'deposits', 'edit'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You do not have permission to review deposits.')

        deposit    = self.get_object()
        action_val = request.data.get('action', '')
        message    = request.data.get('message', '').strip()

        VALID = (
            DepositLog.STATUS_FOR_REVIEW,
            DepositLog.STATUS_IN_PROGRESS,
            DepositLog.STATUS_COMPLETED,
            DepositLog.STATUS_APPROVED,
            DepositLog.STATUS_REJECTED,
            'added',  # special: sets slip_status to 'added', keeps status as in_progress
        )
        if action_val not in VALID:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'action': f'Must be one of: {", ".join(VALID)}.'})

        # 'added' is a slip_status shorthand, not a real status value
        if action_val == 'added':
            deposit.status     = DepositLog.STATUS_IN_PROGRESS
            deposit.slip_status = DepositLog.SLIP_ADDED
        else:
            deposit.status = action_val

        deposit.review_message = message
        deposit.reviewed_by    = request.user
        deposit.reviewed_at    = timezone.now()

        update_fields = ['status', 'slip_status', 'review_message', 'reviewed_by', 'reviewed_at', 'updated_at']

        # Handle back-office receipt upload
        review_slip = request.FILES.get('review_slip')
        if review_slip:
            deposit.review_slip = review_slip
            deposit.slip_status = DepositLog.SLIP_ADDED   # auto-mark slip as added
            update_fields += ['review_slip', 'slip_status']

        deposit.save(update_fields=update_fields)

        try:
            push_deposit_event(deposit, request.user, 'reviewed')
        except Exception:
            pass

        # Log activity
        DepositActivity.objects.create(
            deposit=deposit,
            actor=request.user,
            action=DepositActivity.ACTION_REVIEWED,
            message=f'Reviewed as "{action_val}". {message}'.strip(),
            slip_url=deposit.review_slip.url if deposit.review_slip else '',
        )

        return success_response(
            f'Deposit marked as {action_val}.',
            self.get_serializer(deposit).data,
        )

    # ------------------------------------------------------------------
    # Activity timeline
    # ------------------------------------------------------------------

    @extend_schema(summary='Get deposit activity timeline', tags=['Deposits'])
    @action(detail=True, methods=['get'], url_path='activities')
    def activities(self, request, pk=None):
        deposit = self.get_object()
        activities = deposit.activities.select_related('actor').all()
        return success_response(
            'Activities fetched',
            DepositActivitySerializer(activities, many=True).data,
        )


# ── Deposit Notifications ──────────────────────────────────────────────────

class DepositNotificationViewSet(
    ListModelMixin, RetrieveModelMixin, GenericViewSet,
):
    serializer_class = DepositNotificationSerializer
    pagination_class = StandardResultsPagination
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DepositNotification.objects.filter(recipient=self.request.user)

    @extend_schema(summary='Unread deposit notification count', tags=['Deposits'])
    @action(detail=False, methods=['get'], url_path='unread_count')
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return success_response('Unread count fetched', {'count': count})

    @extend_schema(summary='Mark deposit notification as read', tags=['Deposits'])
    @action(detail=True, methods=['post'], url_path='mark_read')
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=['is_read'])
        return success_response('Notification marked as read', self.get_serializer(notif).data)

    @extend_schema(summary='Mark all deposit notifications as read', tags=['Deposits'])
    @action(detail=False, methods=['post'], url_path='mark_all_read')
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return success_response('All notifications marked as read')

    @extend_schema(summary='Delete a single deposit notification', tags=['Deposits'])
    @action(detail=True, methods=['delete'], url_path='delete')
    def delete_notif(self, request, pk=None):
        notif = self.get_object()
        notif.delete()
        return success_response('Notification deleted')

    @extend_schema(summary='Clear all deposit notifications', tags=['Deposits'])
    @action(detail=False, methods=['post'], url_path='clear_all')
    def clear_all(self, request):
        self.get_queryset().delete()
        return success_response('All notifications cleared')
