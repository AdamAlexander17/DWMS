from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import DepositLogViewSet, NotificationViewSet

router = DefaultRouter()
router.register('deposits', DepositLogViewSet, basename='deposit-log')
router.register('deposits/notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
]
