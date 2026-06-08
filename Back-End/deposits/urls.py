from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DepositLogViewSet, DepositNotificationViewSet

router = DefaultRouter()
router.register('deposits',               DepositLogViewSet,          basename='deposit-log')
router.register('deposits/notifications', DepositNotificationViewSet, basename='deposit-notification')

urlpatterns = [
    path('', include(router.urls)),
]
