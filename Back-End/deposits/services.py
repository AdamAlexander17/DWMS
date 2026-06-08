# Deposit services
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import DepositLog, DepositNotification


def _notif_group(user_id: int) -> str:
    """Mirror of withdrawals.consumers.user_notif_group."""
    return f'user_notif_{user_id}'


def push_deposit_event(deposit, actor, event_type: str):
    """
    Push a real-time WS message to every affected user and persist a
    DepositNotification for each recipient.

    event_type: 'created' | 'updated' | 'reviewed'

    Routing rules:
      - RM creates / edits  → notify Admin + all Back-Office users
      - BO / Admin reviews  → notify the RM who submitted the deposit
    """
    from auth.models import User  # local import to avoid circular

    actor_role = (getattr(actor.role, 'name', None) or '').lower()

    # Compute channel detail label
    if deposit.channel_type == DepositLog.CHANNEL_QR and deposit.qr_code_id:
        channel_label = f'QR · {getattr(deposit.qr_code, "name", "") or ""}'
    elif deposit.channel_type == DepositLog.CHANNEL_UPI and deposit.upi_source_id:
        channel_label = f'UPI · {getattr(deposit.upi_source, "upi_id", "") or ""}'
    elif deposit.channel_type == DepositLog.CHANNEL_BANK and deposit.bank_account_id:
        channel_label = f'Bank · {getattr(deposit.bank_account, "bank_name", "") or ""}'
    else:
        channel_label = ''

    gw_name = deposit.gateway.name if deposit.gateway_id else ''
    submitter = deposit.submitted_by.username if deposit.submitted_by_id else 'someone'

    if event_type in ('created', 'updated'):
        # RM did something → tell back-office + admins
        recipients = list(
            User.objects.filter(role__name__in=['admin', 'back_office'])
                        .exclude(pk=actor.pk)
        )
        action_verb = 'logged a new deposit' if event_type == 'created' else 'updated an existing deposit'
        status_label = deposit.get_status_display()
        details = []
        if gw_name:        details.append(f'Gateway {gw_name}')
        if channel_label:  details.append(channel_label)
        details.append(f'Status: {status_label}')
        message = f'{actor.username} {action_verb} — ' + ', '.join(details) + '.'
    else:
        # BO reviewed → tell the RM who submitted
        recipients = []
        if deposit.submitted_by_id and deposit.submitted_by_id != actor.pk:
            try:
                recipients = [User.objects.get(pk=deposit.submitted_by_id)]
            except User.DoesNotExist:
                pass
        status_label = deposit.get_status_display()
        details = []
        if gw_name:       details.append(f'Gateway {gw_name}')
        if channel_label: details.append(channel_label)
        details.append(f'New status: {status_label}')
        note = f" Note: '{deposit.review_message}'" if deposit.review_message else ''
        message = (
            f'{actor.username} reviewed your deposit — '
            + ', '.join(details) + '.' + note
        )

    channel_layer = get_channel_layer()

    for recipient in recipients:
        # Persist notification
        notif = DepositNotification.objects.create(
            recipient=recipient,
            deposit_log=deposit,
            level='info',
            channel_label=channel_label,
            message=message,
            is_read=False,
        )
        unread_count = DepositNotification.objects.filter(
            recipient=recipient, is_read=False
        ).count()

        # Push over WS
        async_to_sync(channel_layer.group_send)(
            _notif_group(recipient.pk),
            {
                'type': 'notify',
                'payload': {
                    'type':         'deposit_update',
                    'event':        event_type,
                    'deposit_id':   deposit.pk,
                    'message':      message,
                    'unread_count': unread_count,
                    'notification': {
                        'id':          notif.pk,
                        'message':     message,
                        'is_read':     False,
                        'created_at':  notif.created_at.isoformat(),
                    },
                },
            },
        )
