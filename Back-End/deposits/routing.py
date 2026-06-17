from django.urls import path

from .consumers import DepositTicketConsumer


websocket_urlpatterns = [
    path('ws/deposits/<int:deposit_id>/', DepositTicketConsumer.as_asgi()),
]
