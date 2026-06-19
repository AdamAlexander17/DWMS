from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from common.permissions import ModulePermission
from common.responses import success_response, error_response

from .models import Gateway
from .serializers import GatewaySerializer, GatewayWriteSerializer
from .services import GatewayService


class GatewayViewSet(ViewSet):
    """
    list   GET  /master/gateways/            – all active gateways (authenticated users)
    create POST /master/gateways/            – create gateway (admin/back-office)
    retrieve GET /master/gateways/{id}/      – single gateway
    update PATCH /master/gateways/{id}/     – rename gateway (admin/back-office)
    destroy DELETE /master/gateways/{id}/   – deactivate gateway (admin/back-office)
    activate POST /master/gateways/{id}/activate/
    deactivate POST /master/gateways/{id}/deactivate/
    """

    def get_permissions(self):
        action_map = {
            'list': 'view',
            'retrieve': 'view',
            'create': 'create',
            'partial_update': 'edit',
            'destroy': 'delete',
            'activate': 'activate',
            'deactivate': 'activate',
        }
        return [IsAuthenticated(), ModulePermission('gateways', action_map.get(self.action, 'view'))()]

    def list(self, request):
        # Management page passes ?all=true to see inactive gateways too
        show_all = request.query_params.get('all', '').lower() in ('true', '1')
        qs = Gateway.objects.all() if show_all else Gateway.objects.filter(is_active=True)
        search = (request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(name__icontains=search)
        return success_response('Gateways fetched successfully', GatewaySerializer(qs, many=True).data)

    def create(self, request):
        ser = GatewayWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            gw = GatewayService.create(ser.validated_data['name'])
        except ValueError as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        return success_response('Gateway created successfully', GatewaySerializer(gw).data, status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        try:
            gw = Gateway.objects.get(pk=pk)
        except Gateway.DoesNotExist:
            return error_response('Gateway not found.', status_code=status.HTTP_404_NOT_FOUND)
        return success_response('Gateway fetched successfully', GatewaySerializer(gw).data)

    def partial_update(self, request, pk=None):
        try:
            gw = Gateway.objects.get(pk=pk)
        except Gateway.DoesNotExist:
            return error_response('Gateway not found.', status_code=status.HTTP_404_NOT_FOUND)
        ser = GatewayWriteSerializer(gw, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        try:
            gw = GatewayService.update(gw, ser.validated_data['name'])
        except ValueError as exc:
            return error_response(str(exc), status_code=status.HTTP_400_BAD_REQUEST)
        return success_response('Gateway updated successfully', GatewaySerializer(gw).data)

    def destroy(self, request, pk=None):
        from django.db.models.deletion import ProtectedError
        try:
            gw = Gateway.objects.get(pk=pk)
        except Gateway.DoesNotExist:
            return error_response('Gateway not found.', status_code=status.HTTP_404_NOT_FOUND)
        try:
            gw.delete()
        except ProtectedError:
            return error_response(
                f"Gateway '{gw.name}' has linked records and cannot be deleted. Deactivate it instead.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            return error_response(
                f"Gateway '{gw.name}' cannot be deleted due to linked records. Deactivate it instead.",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        return success_response(f"Gateway '{gw.name}' deleted successfully.", status_code=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        try:
            gw = Gateway.objects.get(pk=pk)
        except Gateway.DoesNotExist:
            return error_response('Gateway not found.', status_code=status.HTTP_404_NOT_FOUND)
        GatewayService.activate(gw)
        return success_response('Gateway activated successfully', GatewaySerializer(gw).data)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        try:
            gw = Gateway.objects.get(pk=pk)
        except Gateway.DoesNotExist:
            return error_response('Gateway not found.', status_code=status.HTTP_404_NOT_FOUND)
        GatewayService.deactivate(gw)
        return success_response('Gateway deactivated successfully', GatewaySerializer(gw).data)
