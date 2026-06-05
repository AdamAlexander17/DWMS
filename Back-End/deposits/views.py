from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import CreateModelMixin, DestroyModelMixin, ListModelMixin, RetrieveModelMixin, UpdateModelMixin
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import GenericViewSet
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view

from common.pagination import StandardResultsPagination
from common.permissions import IsAdmin, IsAdminOrBackOffice, IsRM, _role_name
from common.responses import success_response

from .filters import DepositLogFilter
from .models import ChannelNotification, DepositLog
from .serializers import ChannelNotificationSerializer, DepositLogSerializer


@extend_schema_view(
    list=extend_schema(summary='List deposit logs', tags=['Deposits']),
    retrieve=extend_schema(summary='Get deposit log', tags=['Deposits']),
    create=extend_schema(summary='Log a client deposit (RM only)', tags=['Deposits']),
    update=extend_schema(summary='Update a deposit log', tags=['Deposits']),
    partial_update=extend_schema(summary='Partially update a deposit log', tags=['Deposits']),
    destroy=extend_schema(summary='Delete a deposit log', tags=['Deposits']),
)
class DepositLogViewSet(CreateModelMixin, UpdateModelMixin, DestroyModelMixin, ListModelMixin, RetrieveModelMixin, GenericViewSet):
    serializer_class = DepositLogSerializer
    pagination_class = StandardResultsPagination
    filterset_class  = DepositLogFilter
    ordering_fields  = ['created_at', 'deposit_at', 'amount']
    search_fields    = ['client_name', 'utr_number']

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsRM()]
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsAuthenticated()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = DepositLog.objects.select_related('brand', 'submitted_by').all()
        user = self.request.user
        role = _role_name(user)
        if role in ('rm', 'back_office'):
            # Both RM and back_office see only deposits for their assigned brands
            qs = qs.filter(brand__in=user.brands.all())
        # admin sees everything
        return qs

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
        instance = self.get_object()
        instance.delete()
        return success_response('Deposit deleted successfully', status_code=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='review')
    def review(self, request, pk=None):
        """Admin or Back Office approves / rejects a pending deposit."""
        if not IsAdminOrBackOffice().has_permission(request, self):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only admin or back office can review deposits.')

        deposit = self.get_object()
        action_val = request.data.get('action', '')
        message    = request.data.get('message', '').strip()

        if action_val not in (DepositLog.STATUS_APPROVED, DepositLog.STATUS_REJECTED):
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'action': 'Must be "approved" or "rejected".' })

        deposit.status         = action_val
        deposit.review_message = message
        deposit.reviewed_by    = request.user
        deposit.reviewed_at    = timezone.now()
        deposit.save(update_fields=['status', 'review_message', 'reviewed_by', 'reviewed_at'])

        return success_response(
            f'Deposit {action_val} successfully.',
            self.get_serializer(deposit).data,
        )


@extend_schema_view(
    list=extend_schema(summary='List channel notifications', tags=['Notifications']),
    retrieve=extend_schema(summary='Get notification', tags=['Notifications']),
    unread_count=extend_schema(summary='Get unread notification count', tags=['Notifications']),
    mark_read=extend_schema(summary='Mark a notification as read', tags=['Notifications'], request=None),
    mark_all_read=extend_schema(summary='Mark all notifications as read', tags=['Notifications'], request=None),
)
class NotificationViewSet(ListModelMixin, RetrieveModelMixin, GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class   = ChannelNotificationSerializer
    pagination_class   = StandardResultsPagination

    def get_queryset(self):
        qs = ChannelNotification.objects.select_related('brand').all()
        user = self.request.user
        role = _role_name(user)
        if role in ('rm', 'back_office'):
            qs = qs.filter(brand__in=user.brands.all())
        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return success_response('Notifications fetched successfully', serializer.data)

    def retrieve(self, request, *args, **kwargs):
        return success_response(
            'Notification fetched successfully',
            self.get_serializer(self.get_object()).data,
        )

    @action(detail=False, methods=['get'], url_path='unread_count')
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return success_response('Unread count fetched', {'count': count})

    @action(detail=True, methods=['post'], url_path='mark_read')
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=['is_read'])
        return success_response(
            'Notification marked as read',
            self.get_serializer(notification).data,
        )

    @action(detail=False, methods=['post'], url_path='mark_all_read')
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return success_response(f'{updated} notification(s) marked as read', {'updated': updated})
