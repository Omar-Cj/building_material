# suppliers/views.py

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils.translation import gettext_lazy as _

from .models import Supplier, SupplierContact, SupplierMaterial
from .serializers import (
    SupplierSerializer,
    SupplierDetailSerializer,
    SupplierContactSerializer,
    SupplierMaterialSerializer
)
from users.permissions import (
    IsAdminOrManager,
    IsAdminOrManagerOrReadOnly
)
from users.models import UserActivity


class SupplierViewSet(viewsets.ModelViewSet):
    """API endpoints for supplier management."""
    
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'city']
    search_fields = ['name', 'contact_person', 'email', 'phone', 'address', 'city']
    ordering_fields = ['name', 'created_at', 'credit_limit']
    
    def get_serializer_class(self):
        """Return appropriate serializer class based on action."""
        if self.action == 'retrieve':
            return SupplierDetailSerializer
        return SupplierSerializer
    
    def perform_create(self, serializer):
        """Create a new supplier and log activity."""
        supplier = serializer.save()
        # Log activity
        UserActivity.objects.create(
            user=self.request.user,
            action="Supplier Created",
            module="Suppliers",
            description=f"Created supplier: {supplier.name}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
    
    def perform_update(self, serializer):
        """Update a supplier and log activity."""
        supplier = serializer.save()
        # Log activity
        UserActivity.objects.create(
            user=self.request.user,
            action="Supplier Updated",
            module="Suppliers",
            description=f"Updated supplier: {supplier.name}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
    
    def perform_destroy(self, instance):
        """Soft delete supplier by deactivating."""
        instance.is_active = False
        instance.save()
        # Log activity
        UserActivity.objects.create(
            user=self.request.user,
            action="Supplier Deactivated",
            module="Suppliers",
            description=f"Deactivated supplier: {instance.name}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
    
    @action(detail=True, methods=['get'])
    def contacts(self, request, pk=None):
        """Get all contacts for a supplier."""
        supplier = self.get_object()
        contacts = SupplierContact.objects.filter(supplier=supplier)
        serializer = SupplierContactSerializer(contacts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def materials(self, request, pk=None):
        """Get all materials supplied by a supplier."""
        supplier = self.get_object()
        materials = SupplierMaterial.objects.filter(supplier=supplier)
        serializer = SupplierMaterialSerializer(materials, many=True)
        return Response(serializer.data)


class SupplierContactViewSet(viewsets.ModelViewSet):
    """API endpoints for supplier contacts."""
    
    queryset = SupplierContact.objects.all()
    serializer_class = SupplierContactSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['supplier', 'is_primary']
    search_fields = ['name', 'email', 'phone', 'position']
    ordering_fields = ['name', 'supplier__name']
    
    def perform_create(self, serializer):
        """Create contact and log activity."""
        contact = serializer.save()
        # Log activity
        UserActivity.objects.create(
            user=self.request.user,
            action="Supplier Contact Created",
            module="Suppliers",
            description=f"Created contact {contact.name} for supplier: {contact.supplier.name}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )


class SupplierMaterialViewSet(viewsets.ModelViewSet):
    """API endpoints for supplier materials."""
    
    queryset = SupplierMaterial.objects.all()
    serializer_class = SupplierMaterialSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['supplier', 'material', 'is_preferred']
    search_fields = ['supplier_material_code', 'notes']
    ordering_fields = ['supplier__name', 'material__name', 'unit_price', 'lead_time_days']
    
    @action(detail=False, methods=['get'])
    def material_suppliers(self, request):
        """Get all suppliers for a specific material."""
        material_id = request.query_params.get('material_id', None)
        if not material_id:
            return Response(
                {'error': _('material_id parameter is required')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        supplier_materials = SupplierMaterial.objects.filter(material_id=material_id)
        serializer = self.get_serializer(supplier_materials, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def preferred_supplier(self, request):
        """Get preferred supplier for a specific material."""
        material_id = request.query_params.get('material_id', None)
        if not material_id:
            return Response(
                {'error': _('material_id parameter is required')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            supplier_material = SupplierMaterial.objects.filter(
                material_id=material_id, 
                is_preferred=True
            ).first()
            
            if not supplier_material:
                # If no preferred supplier, get the one with lowest price
                supplier_material = SupplierMaterial.objects.filter(
                    material_id=material_id
                ).order_by('unit_price').first()
            
            if supplier_material:
                serializer = self.get_serializer(supplier_material)
                return Response(serializer.data)
            else:
                return Response(
                    {'message': _('No suppliers found for this material')},
                    status=status.HTTP_404_NOT_FOUND
                )
                
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )