from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BankAccountViewSet, QRCodeViewSet, UPISourceViewSet

router = DefaultRouter()
router.register('payments/qr', QRCodeViewSet, basename='qr-code')
router.register('payments/upi', UPISourceViewSet, basename='upi-source')
router.register('payments/bank', BankAccountViewSet, basename='bank-account')

urlpatterns = [
    path('', include(router.urls)),
]
