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

from common.pagination import StandardResultsPagination
from common.permissions import IsAdminOrBackOffice, IsRM
from common.responses import success_response

from .filters import DepositLogFilter
from .models import DepositLog, DepositNotification
from .serializers import DepositLogSerializer, DepositNotificationSerializer
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
    search_fields    = ['comment', 'ark_id']

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsRM()]
        return [IsAuthenticated()]

    def get_queryset(self):
        return DepositLog.objects.select_related(
            'submitted_by', 'reviewed_by', 'gateway',
            'qr_code', 'upi_source', 'bank_account',
        ).all()

    # ------------------------------------------------------------------
    # Standard actions
    # ------------------------------------------------------------------

    def list(self, request, *args, **kwargs):
        from django.db.models import Q
        queryset = self.filter_queryset(self.get_queryset())
        is_history = request.query_params.get('status') == DepositLog.STATUS_COMPLETED

        # Default list excludes completed deposits (those live in Deposit History).
        # History page explicitly requests ?status=completed to see them.
        if 'status' not in request.query_params:
            queryset = queryset.exclude(status=DepositLog.STATUS_COMPLETED)

        # History view: scope to records the user is personally tied to (admin keeps full visibility).
        user      = request.user
        role_name = (getattr(user.role, 'name', None) or '').lower() if getattr(user, 'role', None) else ''
        if is_history and role_name == 'rm':
            queryset = queryset.filter(submitted_by=user)
        elif is_history and role_name == 'back_office':
            queryset = queryset.filter(Q(submitted_by=user) | Q(reviewed_by=user))

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
        return success_response('Deposit updated successfully', self.get_serializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        self.get_object().delete()
        return success_response('Deposit deleted successfully', status_code=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Review action — Admin / Back Office only
    # ------------------------------------------------------------------

    @extend_schema(summary='Review a deposit (for_review / in_progress / completed)', tags=['Deposits'])
    @action(detail=True, methods=['post'], url_path='review',
            parser_classes=[MultiPartParser, FormParser, JSONParser])
    def review(self, request, pk=None):
        if not IsAdminOrBackOffice().has_permission(request, self):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only admin or back office can review deposits.')

        deposit    = self.get_object()
        action_val = request.data.get('action', '')
        message    = request.data.get('message', '').strip()

        VALID = (
            DepositLog.STATUS_FOR_REVIEW,
            DepositLog.STATUS_IN_PROGRESS,
            DepositLog.STATUS_COMPLETED,
            DepositLog.STATUS_APPROVED,
            DepositLog.STATUS_REJECTED,
        )
        if action_val not in VALID:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'action': f'Must be one of: {", ".join(VALID)}.'})

        deposit.status         = action_val
        deposit.review_message = message
        deposit.reviewed_by    = request.user
        deposit.reviewed_at    = timezone.now()

        update_fields = ['status', 'review_message', 'reviewed_by', 'reviewed_at', 'updated_at']

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

        return success_response(
            f'Deposit marked as {action_val}.',
            self.get_serializer(deposit).data,
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
