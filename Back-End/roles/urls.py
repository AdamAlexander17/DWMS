from rest_framework.routers import DefaultRouter

from .views import RoleViewSet

router = DefaultRouter(trailing_slash=False)
router.register('roles', RoleViewSet, basename='roles')

urlpatterns = router.urls
