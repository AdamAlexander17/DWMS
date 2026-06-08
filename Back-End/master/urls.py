from django.urls import path, include
from rest_framework.routers import SimpleRouter

from .views import GatewayViewSet

router = SimpleRouter(trailing_slash=False)
router.register('master/gateways', GatewayViewSet, basename='gateway')

urlpatterns = [
    path('', include(router.urls)),
]
