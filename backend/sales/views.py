# sales/views.py
from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated
from .models import Sale
from .serializers import SaleSerializer
from users.permissions import IsAdminOrManagerOrReadOnly
from users.models import UserActivity

class SaleViewSet(viewsets.ModelViewSet):
    """
    API endpoints for creating and managing sales orders.
    """
    queryset = Sale.objects.filter(is_deleted=False)
    serializer_class = SaleSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['customer', 'payment_method', 'sale_date']
    ordering_fields = ['sale_date', 'total_amount']

    def perform_create(self, serializer):
        sale = serializer.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Sale Created",
            module="Sales",
            description=f"Created sale #{sale.id}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_update(self, serializer):
        sale = serializer.save(updated_by=self.request.user)
        UserActivity.objects.create(
            user=self.request.user,
            action="Sale Updated",
            module="Sales",
            description=f"Updated sale #{sale.id}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Sale Deleted",
            module="Sales",
            description=f"Deleted sale #{instance.id}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
