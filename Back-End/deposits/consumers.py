"""WebSocket consumer for live deposit chat."""

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import DepositLog


def deposit_group(deposit_id: int) -> str:
    return f'deposit_ticket_{deposit_id}'


class DepositTicketConsumer(AsyncJsonWebsocketConsumer):
    """Channel for a single deposit ticket: live new chat messages."""

    async def connect(self):
        user = self.scope.get('user')
        if not user or not getattr(user, 'is_authenticated', False):
            await self.close(code=4001)
            return

        self.deposit_id = int(self.scope['url_route']['kwargs']['deposit_id'])
        allowed = await self._can_access(user, self.deposit_id)
        if not allowed:
            await self.close(code=4003)
            return

        self.group = deposit_group(self.deposit_id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, 'group'):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    @database_sync_to_async
    def _can_access(self, user, deposit_id):
        from common.permissions import is_admin_user, has_module_permission
        try:
            dep = DepositLog.objects.get(pk=deposit_id)
        except DepositLog.DoesNotExist:
            return False
        if is_admin_user(user):
            return True
        if dep.submitted_by_id == user.pk:
            return True
        if (has_module_permission(user, 'deposits', 'review')
                or has_module_permission(user, 'deposits', 'edit')
                or has_module_permission(user, 'deposits', 'activate')):
            return True
        return False

    # broadcast handler
    async def message_created(self, event):
        await self.send_json({'type': 'message_created', 'message': event['message']})
