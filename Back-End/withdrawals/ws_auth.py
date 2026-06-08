"""JWT-based auth for WebSocket connections (token in ?token= query string)."""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

User = get_user_model()


@database_sync_to_async
def _get_user(user_id):
    try:
        return User.objects.select_related('role').get(pk=user_id)
    except User.DoesNotExist:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """Authenticate a WebSocket connection using ?token=<access_jwt>."""

    async def __call__(self, scope, receive, send):
        token = None
        qs = parse_qs(scope.get('query_string', b'').decode())
        if 'token' in qs and qs['token']:
            token = qs['token'][0]

        scope['user'] = AnonymousUser()
        if token:
            try:
                payload = UntypedToken(token)
                user_id = payload['user_id']
                scope['user'] = await _get_user(user_id)
            except (InvalidToken, TokenError, KeyError):
                pass

        return await super().__call__(scope, receive, send)
