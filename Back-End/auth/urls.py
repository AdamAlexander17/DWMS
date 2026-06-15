from django.urls import path

from .views import (
    ChangePasswordView,
    LoginView,
    LogoutView,
    PermissionsView,
    ProfileView,
    TokenRefreshView,
)

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('auth/profile/', ProfileView.as_view(), name='auth-profile'),
    path('auth/permissions/', PermissionsView.as_view(), name='auth-permissions'),
]
