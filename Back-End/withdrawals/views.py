from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from audit_logs.services import AuditLogService
from common.pagination import StandardResultsPagination
from common.responses import error_response, success_response
from common.utils import get_client_ip

from .models import Withdrawal, WithdrawalMessage, WithdrawalNotification
from .serializers import (
    EmailSentSerializer, ManualCloseSerializer, NotReceivedSerializer,
    PostMessageSerializer, UploadSlipSerializer,
    WithdrawalMessageSerializer, WithdrawalNotificationSerializer,
    WithdrawalReviewSerializer, WithdrawalSerializer,
)

User = get_user_model()


def _role(user) -> str:
    return (getattr(user.role, 'name', None) or '').lower()


def _notify(withdrawal, notif_type, message, recipients):
    recipients = [r for r in (recipients or []) if r is not None]
    if not recipients:
        return
    WithdrawalNotification.objects.bulk_create([
        WithdrawalNotification(
            withdrawal=withdrawal, recipient=r,
            notif_type=notif_type, message=message,
        )
        for r in recipients
    ])


class WithdrawalViewSet(ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class   = WithdrawalSerializer
    pagination_class   = StandardResultsPagination
    http_method_names  = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_queryset(self):
        user = self.request.user
        role = _role(user)
        qs   = Withdrawal.objects.select_related(
            'brand', 'submitted_by', 'reviewed_by', 'slip_uploaded_by'
        )
        if role == 'rm':
            return qs.filter(submitted_by=user)
        if role == 'back_office':
            return qs.filter(brand__in=user.brands.all())
        return qs  # admin

    # ── List ──────────────────────────────────────────────────────────────
    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        status_filter = request.query_params.get('status')
        search        = request.query_params.get('search')
        history       = request.query_params.get('history')

        if history in ('1', 'true', 'True'):
            qs = qs.filter(status__in=['closed', 'approved', 'rejected'])
        elif history in ('0', 'false', 'False'):
            qs = qs.exclude(status__in=['closed', 'approved', 'rejected'])

        if status_filter:
            # support comma-separated values: ?status=closed,approved
            statuses = [s.strip() for s in status_filter.split(',') if s.strip()]
            qs = qs.filter(status__in=statuses) if len(statuses) > 1 else qs.filter(status=statuses[0])
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(client_name__icontains=search) | Q(client_arc_id__icontains=search)
            )
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(
                WithdrawalSerializer(page, many=True, context={'request': request}).data
            )
        return success_response(
            'Withdrawals fetched',
            WithdrawalSerializer(qs, many=True, context={'request': request}).data,
        )

    def retrieve(self, request, *args, **kwargs):
        return success_response(
            'Withdrawal fetched',
            WithdrawalSerializer(self.get_object(), context={'request': request}).data,
        )

    # ── Create (RM submits) ───────────────────────────────────────────────
    def create(self, request, *args, **kwargs):
        serializer = WithdrawalSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
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
            WithdrawalSerializer(instance, context={'request': request}).data,
            status_code=status.HTTP_201_CREATED,
        )

    # ── Update ────────────────────────────────────────────────────────────
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if _role(request.user) == 'rm' and instance.submitted_by_id != request.user.pk:
            return error_response('You can only edit your own tickets', status_code=status.HTTP_403_FORBIDDEN)

        partial = kwargs.pop('partial', False)
        serializer = WithdrawalSerializer(instance, data=request.data, partial=partial, context={'request': request})
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        AuditLogService.log(
            user=request.user,
            action='Updated withdrawal request',
            module='Withdrawal',
            ip_address=get_client_ip(request),
        )
        return success_response(
            'Withdrawal updated',
            WithdrawalSerializer(instance, context={'request': request}).data,
        )

    # ── Delete ────────────────────────────────────────────────────────────
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        role = _role(request.user)
        if role == 'rm' and instance.submitted_by_id != request.user.pk:
            return error_response('You can only delete your own tickets', status_code=status.HTTP_403_FORBIDDEN)
        instance.delete()
        AuditLogService.log(
            user=request.user,
            action='Deleted withdrawal request',
            module='Withdrawal',
            ip_address=get_client_ip(request),
        )
        return success_response('Withdrawal deleted', status_code=status.HTTP_204_NO_CONTENT)

    # ── Upload Slip (Back Office) ─────────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='upload-slip')
    def upload_slip(self, request, pk=None):
        if _role(request.user) not in ('admin', 'back_office'):
            return error_response('Only Back Office or Admin can upload slips', status_code=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        if instance.status != 'pending':
            return error_response('Slip can only be uploaded for pending tickets', status_code=status.HTTP_400_BAD_REQUEST)

        s = UploadSlipSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        instance.slip             = s.validated_data['slip']
        instance.slip_note        = s.validated_data.get('note', '')
        instance.slip_uploaded_at = timezone.now()
        instance.slip_uploaded_by = request.user
        instance.status           = 'slip_uploaded'
        instance.save(update_fields=[
            'slip', 'slip_note', 'slip_uploaded_at', 'slip_uploaded_by',
            'status', 'updated_at',
        ])

        _notify(
            instance, 'slip_uploaded',
            f'Withdrawal slip uploaded for {instance.client_name} '
            f'(₹{instance.amount}). Please verify receipt with your client.',
            [instance.submitted_by],
        )
        AuditLogService.log(
            user=request.user,
            action=f'Uploaded slip for withdrawal #{instance.pk}',
            module='Withdrawal',
            ip_address=get_client_ip(request),
        )
        return success_response(
            'Slip uploaded and RM notified',
            WithdrawalSerializer(instance, context={'request': request}).data,
        )

    # ── Confirm Received (RM) ─────────────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='confirm-received')
    def confirm_received(self, request, pk=None):
        instance = self.get_object()
        if _role(request.user) != 'rm' or instance.submitted_by_id != request.user.pk:
            return error_response('Not allowed', status_code=status.HTTP_403_FORBIDDEN)
        if instance.status != 'slip_uploaded':
            return error_response('Can only confirm after slip is uploaded', status_code=status.HTTP_400_BAD_REQUEST)

        instance.status = 'closed'
        instance.save(update_fields=['status', 'updated_at'])

        _notify(
            instance, 'closed',
            f'Client {instance.client_name} confirmed receipt of '
            f'₹{instance.amount}. Ticket closed.',
            [instance.slip_uploaded_by],
        )
        AuditLogService.log(
            user=request.user,
            action=f'Confirmed receipt — withdrawal #{instance.pk}',
            module='Withdrawal',
            ip_address=get_client_ip(request),
        )
        return success_response(
            'Great! Ticket closed — client confirmed receipt.',
            WithdrawalSerializer(instance, context={'request': request}).data,
        )

    # ── Not Received (RM) ─────────────────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='not-received')
    def not_received(self, request, pk=None):
        instance = self.get_object()
        if _role(request.user) != 'rm' or instance.submitted_by_id != request.user.pk:
            return error_response('Not allowed', status_code=status.HTTP_403_FORBIDDEN)
        if instance.status != 'slip_uploaded':
            return error_response('Can only report after slip is uploaded', status_code=status.HTTP_400_BAD_REQUEST)

        s = NotReceivedSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        instance.followup_remarks = s.validated_data['followup_remarks']
        instance.status           = 'bank_followup_required'
        instance.save(update_fields=['followup_remarks', 'status', 'updated_at'])

        recipients = list(User.objects.filter(role__name='admin'))
        if instance.brand_id:
            recipients += list(
                User.objects.filter(role__name='back_office', brands=instance.brand)
            )
        _notify(
            instance, 'followup_required',
            f'⚠️ Client {instance.client_name} (ARC: {instance.client_arc_id}) has NOT '
            f'received ₹{instance.amount}. Please follow up with the bank.',
            recipients,
        )
        AuditLogService.log(
            user=request.user,
            action=f'Raised bank follow-up — withdrawal #{instance.pk}',
            module='Withdrawal',
            ip_address=get_client_ip(request),
        )
        return success_response(
            'Back office has been alerted. Please wait for bank follow-up.',
            WithdrawalSerializer(instance, context={'request': request}).data,
        )

    # ── Email Sent to Bank (Back Office) ──────────────────────────────────
    @action(detail=True, methods=['post'], url_path='email-sent')
    def email_sent(self, request, pk=None):
        if _role(request.user) not in ('admin', 'back_office'):
            return error_response('Only Back Office or Admin can perform this action', status_code=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        if instance.status != 'bank_followup_required':
            return error_response('Only applicable for tickets awaiting bank follow-up', status_code=status.HTTP_400_BAD_REQUEST)

        s = EmailSentSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        instance.bank_followup_note = s.validated_data.get('bank_followup_note', '')
        instance.email_sent_at      = timezone.now()
        instance.status             = 'email_sent_to_bank'
        instance.save(update_fields=['bank_followup_note', 'email_sent_at', 'status', 'updated_at'])

        _notify(
            instance, 'email_sent_to_bank',
            f'Back Office has emailed the bank regarding {instance.client_name}\'s '
            f'withdrawal of ₹{instance.amount}. They will follow up shortly.',
            [instance.submitted_by],
        )
        AuditLogService.log(
            user=request.user,
            action=f'Marked email sent — withdrawal #{instance.pk}',
            module='Withdrawal',
            ip_address=get_client_ip(request),
        )
        return success_response(
            'Email to bank recorded. RM has been notified.',
            WithdrawalSerializer(instance, context={'request': request}).data,
        )

    # ── Conversation / Messages ───────────────────────────────────────────
    def _can_participate(self, request, instance):
        """Owner RM, brand back-office, or admin can read/post."""
        role = _role(request.user)
        if role == 'admin':
            return True
        if role == 'rm' and instance.submitted_by_id == request.user.pk:
            return True
        if role == 'back_office' and instance.brand_id and \
                request.user.brands.filter(pk=instance.brand_id).exists():
            return True
        return False

    def _message_recipients(self, instance, sender):
        """Everyone party to the ticket EXCEPT the sender."""
        recipients = {instance.submitted_by_id: instance.submitted_by} if instance.submitted_by_id else {}
        for u in User.objects.filter(role__name='admin'):
            recipients[u.pk] = u
        if instance.brand_id:
            for u in User.objects.filter(role__name='back_office', brands=instance.brand):
                recipients[u.pk] = u
        recipients.pop(sender.pk, None)
        return list(recipients.values())

    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, pk=None):
        instance = self.get_object()
        if not self._can_participate(request, instance):
            return error_response('Not allowed', status_code=status.HTTP_403_FORBIDDEN)

        if request.method == 'GET':
            qs = instance.messages.select_related('sender').all()
            return success_response(
                'Messages fetched',
                WithdrawalMessageSerializer(qs, many=True, context={'request': request}).data,
            )

        # POST: create a new message
        s = PostMessageSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        attachment = s.validated_data.get('attachment')
        msg = WithdrawalMessage.objects.create(
            withdrawal     = instance,
            sender         = request.user,
            sender_role    = _role(request.user),
            message        = (s.validated_data.get('message') or '').strip(),
            attachment     = attachment,
            attachment_name= attachment.name if attachment else '',
            is_protected   = bool(s.validated_data.get('is_protected')) if attachment else False,
            password_hint  = s.validated_data.get('password_hint', '') if attachment else '',
        )

        preview = msg.message[:80] if msg.message else f'sent an attachment ({msg.attachment_name})'
        _notify(
            instance, 'new_message',
            f'{request.user.username} on #{instance.pk} ({instance.client_name}): {preview}',
            self._message_recipients(instance, request.user),
        )
        AuditLogService.log(
            user=request.user,
            action=f'Posted message on withdrawal #{instance.pk}',
            module='Withdrawal',
            ip_address=get_client_ip(request),
        )
        return success_response(
            'Message sent',
            WithdrawalMessageSerializer(msg, context={'request': request}).data,
            status_code=status.HTTP_201_CREATED,
        )

    # ── Manual Close (Back Office / Admin) ────────────────────────────────
    @action(detail=True, methods=['post'], url_path='manual-close')
    def manual_close(self, request, pk=None):
        if _role(request.user) not in ('admin', 'back_office'):
            return error_response('Only Back Office or Admin can close tickets', status_code=status.HTTP_403_FORBIDDEN)
        instance = self.get_object()
        if instance.status == 'closed':
            return error_response('Ticket is already closed', status_code=status.HTTP_400_BAD_REQUEST)

        s = ManualCloseSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        note = (s.validated_data.get('note') or '').strip()

        instance.status = 'closed'
        instance.save(update_fields=['status', 'updated_at'])

        if note:
            WithdrawalMessage.objects.create(
                withdrawal  = instance,
                sender      = request.user,
                sender_role = _role(request.user),
                message     = f'✅ Ticket closed by Back Office.\n{note}',
            )

        _notify(
            instance, 'manual_closed',
            f'Back Office closed the ticket for {instance.client_name} (₹{instance.amount}).'
            + (f' Note: {note}' if note else ''),
            [instance.submitted_by] if instance.submitted_by_id else [],
        )
        AuditLogService.log(
            user=request.user,
            action=f'Manually closed withdrawal #{instance.pk}',
            module='Withdrawal',
            ip_address=get_client_ip(request),
        )
        return success_response(
            'Ticket closed',
            WithdrawalSerializer(instance, context={'request': request}).data,
        )

    # ── Notifications ─────────────────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='notifications')
    def list_notifications(self, request):
        notifs = (
            WithdrawalNotification.objects
            .filter(recipient=request.user)
            .select_related('withdrawal')[:30]
        )
        return success_response(
            'Notifications fetched',
            WithdrawalNotificationSerializer(notifs, many=True).data,
        )

    @action(detail=False, methods=['get'], url_path='notifications-count')
    def notifications_count(self, request):
        count = WithdrawalNotification.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        return success_response('Count fetched', {'count': count})

    @action(detail=False, methods=['post'], url_path='notifications-read-all')
    def notifications_read_all(self, request):
        WithdrawalNotification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True)
        return success_response('All notifications marked as read')

    @action(detail=True, methods=['post'], url_path='notifications-read')
    def notification_read(self, request, pk=None):
        WithdrawalNotification.objects.filter(
            pk=pk, recipient=request.user
        ).update(is_read=True)
        return success_response('Notification marked as read')

    # ── Stats (counts + monthly trend) ───────────────────────────────────
    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        from django.db.models import Count, Sum
        from django.db.models.functions import TruncMonth

        qs = self.get_queryset()
        all_statuses = [
            'pending', 'slip_uploaded', 'bank_followup_required',
            'email_sent_to_bank', 'closed', 'approved', 'rejected',
        ]
        agg = qs.values('status').annotate(count=Count('id'), total=Sum('amount'))
        counts  = {s: 0   for s in all_statuses}
        amounts = {s: 0.0 for s in all_statuses}
        for row in agg:
            s = row['status']
            if s in counts:
                counts[s]  = row['count']
                amounts[s] = float(row['total'] or 0)

        chart_keys = ['pending', 'slip_uploaded', 'bank_followup_required', 'closed']
        monthly = (
            qs.annotate(month=TruncMonth('created_at'))
            .values('month', 'status')
            .annotate(count=Count('id'))
            .order_by('month')
        )
        monthly_map = {}
        for row in monthly:
            label = row['month'].strftime('%b %Y') if row['month'] else 'Unknown'
            if label not in monthly_map:
                monthly_map[label] = {'month': label, **{k: 0 for k in chart_keys}}
            s = row['status']
            if s in monthly_map[label]:
                monthly_map[label][s] = row['count']

        return success_response('Stats fetched', {
            'counts':  counts,
            'amounts': amounts,
            'monthly': list(monthly_map.values()),
        })

    # ── Legacy review (approve/reject) ────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='review')
    def review(self, request, pk=None):
        role = _role(request.user)
        if role not in ('admin', 'back_office'):
            return error_response('Only Back Office or Admin can review withdrawals', status_code=status.HTTP_403_FORBIDDEN)

        instance = self.get_object()
        if instance.status not in ('pending',):
            return error_response('This withdrawal has already been processed', status_code=status.HTTP_400_BAD_REQUEST)

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
            WithdrawalSerializer(instance, context={'request': request}).data,
        )
