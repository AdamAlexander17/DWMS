from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from common.permissions import IsAdminOrBackOffice
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
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminOrBackOffice()]

    def list(self, request):
        qs = Gateway.objects.filter(is_active=True)
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
        try:
            gw = Gateway.objects.get(pk=pk)
        except Gateway.DoesNotExist:
            return error_response('Gateway not found.', status_code=status.HTTP_404_NOT_FOUND)
        GatewayService.deactivate(gw)
        return success_response(f"Gateway '{gw.name}' deactivated.")

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
