from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DepositLogViewSet, DepositNotificationViewSet

router = DefaultRouter()
# IMPORTANT: register the more-specific path BEFORE the generic `deposits/<pk>/`
# router, otherwise `/deposits/notifications/` gets matched as
# `DepositLogViewSet.retrieve(pk="notifications")` → 404.
router.register('deposits/notifications', DepositNotificationViewSet, basename='deposit-notification')
router.register('deposits',               DepositLogViewSet,          basename='deposit-log')

urlpatterns = [
    path('', include(router.urls)),
]
