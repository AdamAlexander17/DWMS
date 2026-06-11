from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet
from drf_spectacular.utils import extend_schema, extend_schema_view
from django.db.models import Q

from audit_logs.services import AuditLogService
from common.permissions import IsAdmin
from common.responses import error_response, success_response
from common.utils import get_client_ip

from .models import Module, Role
from .serializers import RoleListSerializer, RoleSerializer
from .services import RoleService


@extend_schema_view(
    list=extend_schema(tags=['Roles']),
    retrieve=extend_schema(tags=['Roles']),
    create=extend_schema(tags=['Roles']),
    update=extend_schema(tags=['Roles']),
    partial_update=extend_schema(tags=['Roles']),
    destroy=extend_schema(tags=['Roles']),
)
class RoleViewSet(ModelViewSet):
    queryset         = Role.objects.prefetch_related('permissions').order_by('name')
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    http_method_names  = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'list':
            return RoleListSerializer
        return RoleSerializer

    def get_queryset(self):
        qs = Role.objects.prefetch_related('permissions')
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        search = (self.request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(users__username__icontains=search)
            ).distinct()
        return qs.order_by('name')

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return error_response('Validation failed', errors=serializer.errors,
                                  status_code=status.HTTP_400_BAD_REQUEST)
        role = serializer.save()
        AuditLogService.log(
            user=request.user, action='create', module='roles',
            ip_address=get_client_ip(request),
        )
        return success_response(
            'Role created successfully',
            data=RoleSerializer(role).data,
            status_code=status.HTTP_201_CREATED,
        )

    # ------------------------------------------------------------------
    # Update (PUT / PATCH)
    # ------------------------------------------------------------------
    def update(self, request, *args, **kwargs):
        partial  = kwargs.pop('partial', False)
        instance = self.get_object()
        # System roles can still have their permissions changed, but not renamed
        if instance.is_system and not partial:
            name_changed = request.data.get('name', instance.name) != instance.name
            if name_changed:
                return error_response(
                    'System role names cannot be changed',
                    status_code=status.HTTP_403_FORBIDDEN,
                )
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            return error_response('Validation failed', errors=serializer.errors,
                                  status_code=status.HTTP_400_BAD_REQUEST)
        role = serializer.save()
        AuditLogService.log(
            user=request.user, action='update', module='roles',
            ip_address=get_client_ip(request),
        )
        return success_response('Role updated successfully', data=RoleSerializer(role).data)

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.users.exists():
            return error_response(
                'Cannot delete a role that is currently assigned to users',
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        name = instance.name
        instance.delete()
        AuditLogService.log(
            user=request.user, action='delete', module='roles',
            ip_address=get_client_ip(request),
        )
        return success_response('Role deleted successfully')

    # ------------------------------------------------------------------
    # Custom actions
    # ------------------------------------------------------------------
    @extend_schema(tags=['Roles'])
    @action(detail=True, methods=['post'], url_path='activate')
    def activate(self, request, pk=None):
        role = self.get_object()
        if role.is_active:
            return error_response('Role is already active',
                                  status_code=status.HTTP_400_BAD_REQUEST)
        role.is_active = True
        role.save(update_fields=['is_active', 'updated_at'])
        AuditLogService.log(
            user=request.user, action='activate', module='roles',
            ip_address=get_client_ip(request),
        )
        return success_response('Role activated', data=RoleListSerializer(role).data)

    @extend_schema(tags=['Roles'])
    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        role = self.get_object()
        if not role.is_active:
            return error_response('Role is already inactive',
                                  status_code=status.HTTP_400_BAD_REQUEST)
        role.is_active = False
        role.save(update_fields=['is_active', 'updated_at'])
        AuditLogService.log(
            user=request.user, action='deactivate', module='roles',
            ip_address=get_client_ip(request),
        )
        return success_response('Role deactivated', data=RoleListSerializer(role).data)

    @extend_schema(tags=['Roles'])
    @action(detail=True, methods=['get'], url_path='permissions/matrix')
    def permissions_matrix(self, request, pk=None):
        """Return the full permission matrix for this role (all modules)."""
        role   = self.get_object()
        matrix = RoleService.full_permission_matrix(role)
        return success_response('Permission matrix fetched', data=matrix)

    @extend_schema(tags=['Roles'])
    @action(detail=False, methods=['get'], url_path='modules')
    def modules(self, request):
        """Return the list of all available modules."""
        data = [{'value': m.value, 'label': m.label} for m in Module]
        return success_response('Modules fetched', data=data)
