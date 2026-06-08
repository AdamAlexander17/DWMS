"""
ASGI config for config project. Routes HTTP to Django and WebSocket to Channels.
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

from withdrawals.ws_auth import JWTAuthMiddleware
from withdrawals.routing import websocket_urlpatterns


application = ProtocolTypeRouter({
    'http':      get_asgi_application(),
    'websocket': JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
})
