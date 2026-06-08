from django.urls import path

from .consumers import NotificationConsumer, TicketConsumer


websocket_urlpatterns = [
    path('ws/notifications/',                   NotificationConsumer.as_asgi()),
    path('ws/withdrawals/<int:ticket_id>/',     TicketConsumer.as_asgi()),
]
