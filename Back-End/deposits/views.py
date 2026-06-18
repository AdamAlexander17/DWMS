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
from .models import DepositLog, DepositNotification, DepositActivity, DepositMessage
from .serializers import DepositLogSerializer, DepositNotificationSerializer, DepositActivitySerializer, DepositMessageSerializer, PostDepositMessageSerializer
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
            'review': 'review',
            'messages': 'view',
            'activities': 'view',
        }
        return [IsAuthenticated(), ModulePermission('deposits', action_map.get(self.action, 'view'))()] 

    def get_queryset(self):
        from django.db.models import Subquery, OuterRef
        from .models import DepositMessageRead

        user = self.request.user

        # Annotate last_read for the current user (used by serializer to compute unread)
        read_sq = DepositMessageRead.objects.filter(
            deposit=OuterRef('pk'), user=user
        ).values('last_read_at')[:1]

        qs = DepositLog.objects.select_related(
            'submitted_by', 'reviewed_by', 'gateway',
            'qr_code', 'upi_source', 'bank_account',
        ).annotate(
            _last_read=Subquery(read_sq),
        )

        user = self.request.user

        # Superuser sees everything
        if user.is_superuser:
            return qs

        # Users with 'activate' permission see all data from their brands
        # Users without 'activate' see only their own data
        if has_module_permission(user, 'deposits', 'activate'):
            if user.brands.exists():
                return qs.filter(
                    Q(submitted_by__brands__in=user.brands.all())
                ).distinct()
            return qs  # activate permission + no brands = see all
        else:
            return qs.filter(submitted_by=user)

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
            slip_url=request.build_absolute_uri(instance.slip.url) if instance.slip else '',
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
            slip_url=request.build_absolute_uri(instance.slip.url) if instance.slip else '',
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
        if not has_module_permission(request.user, 'deposits', 'review'):
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
            deposit.status      = DepositLog.STATUS_IN_PROGRESS
            deposit.slip_status = DepositLog.SLIP_ADDED
        elif action_val == 'in_progress':
            deposit.status = action_val
            # Don't change slip_status — keep whatever it currently is
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
            update_fields += ['review_slip']

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
            slip_url=request.build_absolute_uri(deposit.review_slip.url) if deposit.review_slip else '',
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

    # ------------------------------------------------------------------
    # Chat / Messages
    # ------------------------------------------------------------------

    def _can_participate(self, request, deposit):
        """Submitter, reviewer (has review/edit), or admin can read/post."""
        user = request.user
        if user.is_superuser:
            return True
        if deposit.submitted_by_id == user.pk:
            return True
        if (has_module_permission(user, 'deposits', 'review')
                or has_module_permission(user, 'deposits', 'edit')
                or has_module_permission(user, 'deposits', 'activate')):
            return True
        return False

    def _message_recipients(self, deposit, sender):
        """Everyone party to the deposit EXCEPT the sender."""
        from auth.models import User
        recipients = {}
        if deposit.submitted_by_id:
            recipients[deposit.submitted_by_id] = deposit.submitted_by
        reviewer_qs = User.objects.filter(
            role__permissions__module='deposits',
            role__permissions__can_review=True,
        ).distinct()
        for u in reviewer_qs:
            recipients[u.pk] = u
        recipients.pop(sender.pk, None)
        return list(recipients.values())

    @extend_schema(summary='Deposit chat — list / post messages', tags=['Deposits'])
    @action(detail=True, methods=['get', 'post'], url_path='messages',
            parser_classes=[MultiPartParser, FormParser, JSONParser])
    def messages(self, request, pk=None):
        deposit = self.get_object()
        if not self._can_participate(request, deposit):
            return error_response('Not allowed', status_code=status.HTTP_403_FORBIDDEN)

        if request.method == 'GET':
            qs = deposit.messages.select_related('sender').all()

            # Mark messages as read for this user
            from django.utils import timezone as tz
            from .models import DepositMessageRead
            DepositMessageRead.objects.update_or_create(
                deposit=deposit, user=request.user,
                defaults={'last_read_at': tz.now()},
            )

            # Clear chat notifications for this deposit for this user
            DepositNotification.objects.filter(
                deposit_log=deposit,
                recipient=request.user,
                channel_label__startswith='Chat from',
            ).delete()

            # Broadcast "messages_read" so the sender's ticks update
            try:
                from asgiref.sync import async_to_sync
                from channels.layers import get_channel_layer
                from .consumers import deposit_group
                layer = get_channel_layer()
                if layer:
                    async_to_sync(layer.group_send)(
                        deposit_group(deposit.pk),
                        {'type': 'messages_read', 'user_id': request.user.pk},
                    )
            except Exception:
                pass

            return success_response(
                'Messages fetched',
                DepositMessageSerializer(qs, many=True, context={'request': request}).data,
            )

        # POST: create a new message
        s = PostDepositMessageSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        role_name = (getattr(request.user.role, 'name', None) or '').lower() if getattr(request.user, 'role', None) else ''
        attachment = s.validated_data.get('attachment')
        msg = DepositMessage.objects.create(
            deposit        = deposit,
            sender         = request.user,
            sender_role    = role_name,
            message        = (s.validated_data.get('message') or '').strip(),
            attachment     = attachment,
            attachment_name= attachment.name if attachment else '',
            is_protected   = bool(s.validated_data.get('is_protected')) if attachment else False,
            password_hint  = s.validated_data.get('password_hint', '') if attachment else '',
        )

        msg_data = DepositMessageSerializer(msg, context={'request': request}).data

        # Broadcast over WebSocket to everyone viewing this deposit's chat
        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            from .consumers import deposit_group
            layer = get_channel_layer()
            if layer:
                async_to_sync(layer.group_send)(
                    deposit_group(deposit.pk),
                    {'type': 'message_created', 'message': msg_data},
                )

                # Also push notification to all recipients' personal channels
                # AND persist a DepositNotification so it shows in the Messages tab
                recipients = self._message_recipients(deposit, request.user)
                preview = msg.message[:80] if msg.message else f'sent an attachment ({msg.attachment_name})'
                notif_payload = {
                    'type': 'deposit_message',
                    'deposit_id': deposit.pk,
                    'sender': request.user.username,
                    'message': preview,
                }

                # Persist notifications
                for r in recipients:
                    DepositNotification.objects.create(
                        recipient=r,
                        deposit_log=deposit,
                        level='info',
                        channel_label=f'Chat from {request.user.username}',
                        message=f'{request.user.username}: {preview}',
                        is_read=False,
                    )

                for r in recipients:
                    async_to_sync(layer.group_send)(
                        f'user_notif_{r.pk}',
                        {'type': 'notify', 'payload': notif_payload},
                    )
        except Exception:
            pass

        return success_response('Message sent', msg_data, status_code=status.HTTP_201_CREATED)


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
