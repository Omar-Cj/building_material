from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from .models import PurchaseOrder
from .serializers import PurchaseOrderSerializer
from users.permissions import IsAdminOrManagerOrReadOnly
from users.models import UserActivity

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.filter(is_deleted=False)
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['supplier', 'status', 'created_at', 'received_at']
    ordering_fields = ['created_at', 'received_at']

    def perform_create(self, serializer):
        po = serializer.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Purchase Order Created",
            module="Purchases",
            description=f"PO {po.id} created",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_update(self, serializer):
        po = serializer.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Purchase Order Updated",
            module="Purchases",
            description=f"PO {po.id} updated",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_destroy(self, instance):
        instance.is_deleted = True; instance.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Purchase Order Deleted",
            module="Purchases",
            description=f"PO {instance.id} deleted",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        po = self.get_object()
        if po.status != PurchaseOrder.STATUS_PENDING:
            return Response({'detail':'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)
        po.status = PurchaseOrder.STATUS_RECEIVED
        po.received_at = timezone.now()
        po.save()
        UserActivity.objects.create(
            user=request.user,
            action="Purchase Order Received",
            module="Purchases",
            description=f"PO {po.id} received",
            ip_address=request.META.get('REMOTE_ADDR')
        )
        return Response(self.get_serializer(po).data)