from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ReadOnlyModelViewSet

from common.permissions import IsAdmin
from common.responses import success_response

from .filters import AuditLogFilter
from .models import AuditLog
from .serializers import AuditLogSerializer


@extend_schema_view(
    list=extend_schema(summary='List audit logs', tags=['Audit Logs']),
    retrieve=extend_schema(summary='Get audit log entry', tags=['Audit Logs']),
)
class AuditLogViewSet(ReadOnlyModelViewSet):
    """
    Read-only audit log viewer.  Admin access only.
    """

    permission_classes = [IsAuthenticated, IsAdmin]
    queryset = AuditLog.objects.select_related('user').all()
    serializer_class = AuditLogSerializer
    filterset_class = AuditLogFilter
    search_fields = ['action', 'module', 'user__username']
    ordering_fields = ['timestamp', 'module', 'action']

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return success_response('Audit logs fetched successfully', serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return success_response('Audit log fetched successfully', self.get_serializer(instance).data)
