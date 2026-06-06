from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import WithdrawalViewSet

router = DefaultRouter()
router.register('withdrawals', WithdrawalViewSet, basename='withdrawal')

urlpatterns = [
    path('', include(router.urls)),
]
