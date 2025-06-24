
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils.translation import gettext_lazy as _
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated

from .models import (
    Customer, CustomerContact, CustomerShippingAddress, CustomerPayment
)
from .serializers import (
    CustomerSerializer, CustomerDetailSerializer,
    CustomerContactSerializer, CustomerShippingAddressSerializer, CustomerPaymentSerializer
)
from users.permissions import IsAdminOrManagerOrReadOnly
from users.models import UserActivity


class CustomerViewSet(viewsets.ModelViewSet):
    """API endpoints for customer management."""
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'customer_type', 'city', 'country']
    search_fields = ['name', 'contact_person', 'email', 'phone']
    ordering_fields = ['name', 'registration_date', 'outstanding_balance']
    pagination_class = None  # Disable pagination for frontend client-side pagination

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CustomerDetailSerializer
        return CustomerSerializer

    def perform_create(self, serializer):
        customer = serializer.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Customer Created",
            module="Customers",
            description=f"Created customer {customer.name}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_update(self, serializer):
        customer = serializer.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Customer Updated",
            module="Customers",
            description=f"Updated customer {customer.name}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_destroy(self, instance):
        instance.status = Customer.INACTIVE
        instance.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Customer Deactivated",
            module="Customers",
            description=f"Deactivated customer {instance.name}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    @action(detail=True, methods=['get'])
    def contacts(self, request, pk=None):
        """Get all contacts for a customer."""
        contacts = CustomerContact.objects.filter(customer_id=pk)
        serializer = CustomerContactSerializer(contacts, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def shipping_addresses(self, request, pk=None):
        """Get all shipping addresses for a customer."""
        addresses = CustomerShippingAddress.objects.filter(customer_id=pk)
        serializer = CustomerShippingAddressSerializer(addresses, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def payments(self, request, pk=None):
        """Get all payments for a customer."""
        payments = CustomerPayment.objects.filter(customer_id=pk)
        serializer = CustomerPaymentSerializer(payments, many=True)
        return Response(serializer.data)


class CustomerContactViewSet(viewsets.ModelViewSet):
    """API endpoints for customer contacts."""
    queryset = CustomerContact.objects.all()
    serializer_class = CustomerContactSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer', 'is_primary']
    search_fields = ['name', 'email', 'phone', 'position']
    ordering_fields = ['-is_primary', 'name']

    def perform_create(self, serializer):
        contact = serializer.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Customer Contact Created",
            module="Customers",
            description=f"Created contact {contact.name} for customer {contact.customer.name}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )


class CustomerShippingAddressViewSet(viewsets.ModelViewSet):
    """API endpoints for customer shipping addresses."""
    queryset = CustomerShippingAddress.objects.all()
    serializer_class = CustomerShippingAddressSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer', 'is_default', 'is_active']
    search_fields = ['address_name', 'city', 'state', 'country']
    ordering_fields = ['-is_default', 'address_name']

    def perform_create(self, serializer):
        address = serializer.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Shipping Address Created",
            module="Customers",
            description=f"Created shipping address {address.address_name} for customer {address.customer.name}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )


class CustomerPaymentViewSet(viewsets.ModelViewSet):
    """API endpoints for customer payments."""
    queryset = CustomerPayment.objects.all()
    serializer_class = CustomerPaymentSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['customer', 'payment_method', 'status']
    search_fields = ['reference_number', 'notes']
    ordering_fields = ['-payment_date', 'amount']

    def perform_create(self, serializer):
        payment = serializer.save(received_by=self.request.user)
        # Adjust customer's outstanding balance if payment completed
        if payment.status == CustomerPayment.COMPLETED:
            customer = payment.customer
            customer.outstanding_balance = max(customer.outstanding_balance - payment.amount, 0)
            customer.updated_by = self.request.user
            customer.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Customer Payment Recorded",
            module="Customers",
            description=f"Recorded payment of {payment.amount} for customer {payment.customer.name}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )