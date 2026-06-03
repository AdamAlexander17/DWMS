from drf_spectacular.utils import OpenApiExample, extend_schema, inline_serializer
from rest_framework import serializers as s
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView as _BaseTokenRefreshView

from audit_logs.services import AuditLogService
from common.responses import error_response, success_response
from common.utils import get_client_ip

from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    ProfileSerializer,
)
from .services import AuthService


# ---------------------------------------------------------------------------
# Auth views
# ---------------------------------------------------------------------------

@extend_schema(tags=['Auth'])
class LoginView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(
        summary='Login — get access & refresh tokens',
        request=LoginSerializer,
        examples=[
            OpenApiExample(
                'Admin login',
                value={'username': 'admin', 'password': 'Admin@1234'},
                request_only=True,
            )
        ],
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            errors = serializer.errors
            msg = (errors.get('non_field_errors') or ['Invalid username or password'])[0]
            return error_response(str(msg), status_code=status.HTTP_400_BAD_REQUEST)
        user = serializer.validated_data['user']
        tokens = AuthService.login(user)
        AuditLogService.log(
            user=user,
            action='User logged in',
            module='Auth',
            ip_address=get_client_ip(request),
        )
        return success_response('Login successful', tokens)


@extend_schema(tags=['Auth'])
class TokenRefreshView(_BaseTokenRefreshView):
    """Wrap simplejwt token refresh to match our standard response format."""

    @extend_schema(
        summary='Refresh access token',
        request=inline_serializer('TokenRefreshRequest', fields={'refresh': s.CharField(help_text='The refresh token obtained during login')}),
    )
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            return success_response('Token refreshed successfully', response.data)
        return response


@extend_schema(tags=['Auth'])
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Logout — blacklist the refresh token',
        request=inline_serializer('LogoutRequest', fields={'refresh': s.CharField(help_text='The refresh token to blacklist')}),
    )
    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return error_response(
                'Refresh token is required',
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        try:
            AuthService.logout(refresh_token)
        except ValueError as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        AuditLogService.log(
            user=request.user,
            action='User logged out',
            module='Auth',
            ip_address=get_client_ip(request),
        )
        return success_response('Logged out successfully')


@extend_schema(tags=['Auth'])
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Change own password',
        request=ChangePasswordSerializer,
    )
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            AuthService.change_password(
                user=request.user,
                old_password=serializer.validated_data['old_password'],
                new_password=serializer.validated_data['new_password'],
            )
        except ValueError as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        AuditLogService.log(
            user=request.user,
            action='Changed password',
            module='Auth',
            ip_address=get_client_ip(request),
        )
        return success_response('Password changed successfully')


@extend_schema(tags=['Auth'])
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary='Get current user profile', responses={200: ProfileSerializer})
    def get(self, request):
        serializer = ProfileSerializer(request.user)
        return success_response('Profile fetched successfully', serializer.data)

