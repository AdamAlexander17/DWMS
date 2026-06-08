"""WebSocket consumers for live withdrawal chat + notifications."""

import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import Withdrawal


def user_notif_group(user_id: int) -> str:
    return f'user_notif_{user_id}'


def ticket_group(ticket_id: int) -> str:
    return f'wd_ticket_{ticket_id}'


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Per-user channel for new notifications + unread-count updates."""

    async def connect(self):
        user = self.scope.get('user')
        if not user or not getattr(user, 'is_authenticated', False):
            await self.close(code=4001)
            return
        self.group = user_notif_group(user.pk)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, 'group'):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    # broadcast handler — payload sent via channel_layer.group_send
    async def notify(self, event):
        await self.send_json(event['payload'])


class TicketConsumer(AsyncJsonWebsocketConsumer):
    """Channel for a single withdrawal ticket: live new messages."""

    async def connect(self):
        user = self.scope.get('user')
        if not user or not getattr(user, 'is_authenticated', False):
            await self.close(code=4001)
            return

        self.ticket_id = int(self.scope['url_route']['kwargs']['ticket_id'])
        allowed = await self._can_access(user, self.ticket_id)
        if not allowed:
            await self.close(code=4003)
            return

        self.group = ticket_group(self.ticket_id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, 'group'):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    @database_sync_to_async
    def _can_access(self, user, ticket_id):
        try:
            wd = Withdrawal.objects.select_related('brand').get(pk=ticket_id)
        except Withdrawal.DoesNotExist:
            return False
        role = (getattr(user.role, 'name', None) or '').lower()
        if role == 'admin':
            return True
        if role == 'rm' and wd.submitted_by_id == user.pk:
            return True
        if role == 'back_office' and wd.brand_id and \
                user.brands.filter(pk=wd.brand_id).exists():
            return True
        return False

    # broadcast handlers
    async def message_created(self, event):
        await self.send_json({'type': 'message_created', 'message': event['message']})

    async def ticket_updated(self, event):
        await self.send_json({'type': 'ticket_updated', 'withdrawal': event['withdrawal']})
