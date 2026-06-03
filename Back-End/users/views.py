from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password as dj_validate_password
from drf_spectacular.utils import extend_schema, extend_schema_view, inline_serializer
from rest_framework import serializers as s
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from audit_logs.services import AuditLogService
from common.permissions import IsAdmin
from common.responses import error_response, success_response
from common.utils import get_client_ip

from .serializers import UserCreateSerializer, UserListSerializer, UserUpdateSerializer
from .services import UserService

User = get_user_model()


@extend_schema_view(
    list=extend_schema(summary='List all users', tags=['Users']),
    retrieve=extend_schema(summary='Get a user by ID', tags=['Users']),
    create=extend_schema(summary='Create a new user', tags=['Users']),
    update=extend_schema(summary='Update a user', tags=['Users']),
    partial_update=extend_schema(summary='Partially update a user', tags=['Users']),
    destroy=extend_schema(summary='Delete a user', tags=['Users']),
    activate=extend_schema(summary='Activate a user', tags=['Users'], request=None),
    deactivate=extend_schema(summary='Deactivate a user', tags=['Users'], request=None),
    reset_password=extend_schema(
        summary="Reset a user's password (admin)",
        tags=['Users'],
        request=inline_serializer(
            'ResetPasswordRequest',
            fields={'new_password': s.CharField(help_text='New password for the user')},
        ),
    ),
)
class UserViewSet(ModelViewSet):
    permission_classes  = [IsAuthenticated, IsAdmin]
    queryset            = User.objects.select_related('role').prefetch_related('brands').all()
    search_fields       = ['username', 'mobile']
    ordering_fields     = ['created_at', 'is_active']
    filterset_fields    = ['role', 'is_active']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ('update', 'partial_update'):
            return UserUpdateSerializer
        return UserListSerializer

    # ------------------------------------------------------------------
    # List
    # ------------------------------------------------------------------
    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = UserListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return success_response('Users fetched successfully', UserListSerializer(queryset, many=True).data)

    # ------------------------------------------------------------------
    # Retrieve
    # ------------------------------------------------------------------
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return success_response('User fetched successfully', UserListSerializer(instance).data)

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------
    def create(self, request, *args, **kwargs):
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        AuditLogService.log(
            user=request.user,
            action='Created user',
            module='User',
            new_data=UserListSerializer(user).data,
            ip_address=get_client_ip(request),
        )
        return success_response('User created successfully', UserListSerializer(user).data, status_code=status.HTTP_201_CREATED)

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------
    def update(self, request, *args, **kwargs):
        partial  = kwargs.pop('partial', False)
        instance = self.get_object()
        old_data = UserListSerializer(instance).data
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        AuditLogService.log(
            user=request.user,
            action='Updated user',
            module='User',
            old_data=dict(old_data),
            new_data=UserListSerializer(user).data,
            ip_address=get_client_ip(request),
        )
        return success_response('User updated successfully', UserListSerializer(user).data)

    # ------------------------------------------------------------------
    # Destroy
    # ------------------------------------------------------------------
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        AuditLogService.log(
            user=request.user,
            action='Deleted user',
            module='User',
            old_data={'id': instance.id, 'username': instance.username},
            ip_address=get_client_ip(request),
        )
        instance.delete()
        return success_response('User deleted successfully', status_code=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Custom actions
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        user = self.get_object()
        if user.is_active:
            return error_response('User is already active')
        UserService.activate(user)
        AuditLogService.log(
            user=request.user,
            action='Activated user',
            module='User',
            new_data={'username': user.username},
            ip_address=get_client_ip(request),
        )
        return success_response('User activated successfully', UserListSerializer(user).data)

    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        user = self.get_object()
        if not user.is_active:
            return error_response('User is already inactive')
        UserService.deactivate(user)
        AuditLogService.log(
            user=request.user,
            action='Deactivated user',
            module='User',
            new_data={'username': user.username},
            ip_address=get_client_ip(request),
        )
        return success_response('User deactivated successfully', UserListSerializer(user).data)

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_password = request.data.get('new_password', '').strip()
        if not new_password:
            return error_response('new_password is required')
        try:
            dj_validate_password(new_password)
        except Exception as exc:
            return error_response(
                'Password validation failed',
                errors={'new_password': list(exc.messages)},
            )
        UserService.reset_password(user, new_password)
        AuditLogService.log(
            user=request.user,
            action='Reset user password',
            module='User',
            new_data={'username': user.username},
            ip_address=get_client_ip(request),
        )
        return success_response('Password reset successfully')
