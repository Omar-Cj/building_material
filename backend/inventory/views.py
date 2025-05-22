# inventory/views.py

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, F, ExpressionWrapper, DecimalField
from django.utils.translation import gettext_lazy as _

from .models import Category, UnitOfMeasure, Material, StockAdjustment, MaterialLocation
from .serializers import (
    CategorySerializer, 
    UnitOfMeasureSerializer, 
    MaterialSerializer, 
    StockAdjustmentSerializer,
    MaterialLocationSerializer
)
from users.permissions import (
    IsAdminOrManager, 
    IsAdminOrManagerOrReadOnly,
    IsWarehouseStaff,
)


class CategoryViewSet(viewsets.ModelViewSet):
    """API endpoints for material categories."""
    
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'parent']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    
    @action(detail=True, methods=['get'])
    def subcategories(self, request, pk=None):
        """Get all subcategories of a category."""
        category = self.get_object()
        subcategories = Category.objects.filter(parent=category)
        serializer = self.get_serializer(subcategories, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def materials(self, request, pk=None):
        """Get all materials in a category."""
        category = self.get_object()
        materials = Material.objects.filter(category=category)
        page = self.paginate_queryset(materials)
        if page is not None:
            serializer = MaterialSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        serializer = MaterialSerializer(materials, many=True, context={'request': request})
        return Response(serializer.data)


class UnitOfMeasureViewSet(viewsets.ModelViewSet):
    """API endpoints for units of measure."""
    
    queryset = UnitOfMeasure.objects.all()
    serializer_class = UnitOfMeasureSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'abbreviation']
    ordering_fields = ['name']


class MaterialViewSet(viewsets.ModelViewSet):
    """API endpoints for materials."""
    
    queryset = Material.objects.all()
    serializer_class = MaterialSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'brand', 'is_active', 'main_supplier']
    search_fields = ['name', 'sku', 'description', 'barcode', 'brand']
    ordering_fields = ['name', 'sku', 'quantity_in_stock', 'price_per_unit', 'cost_per_unit', 'created_at']
    
    def get_queryset(self):
        """Custom queryset to add annotations."""
        queryset = super().get_queryset()
        
        # Add low stock filter if provided
        low_stock = self.request.query_params.get('low_stock', None)
        if low_stock == 'true':
            queryset = queryset.filter(quantity_in_stock__lte=F('reorder_level'))
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get materials with stock below reorder level."""
        materials = Material.objects.filter(
            quantity_in_stock__lte=F('reorder_level'),
            is_active=True
        )
        page = self.paginate_queryset(materials)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(materials, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def stock_value(self, request):
        """Get total stock value."""
        total_value = Material.objects.filter(is_active=True).aggregate(
            total_value=Sum(
                ExpressionWrapper(
                    F('quantity_in_stock') * F('cost_per_unit'), 
                    output_field=DecimalField()
                )
            )
        )
        return Response({'total_stock_value': total_value['total_value'] or 0})


class StockAdjustmentViewSet(viewsets.ModelViewSet):
    """API endpoints for stock adjustments."""
    
    queryset = StockAdjustment.objects.all()
    serializer_class = StockAdjustmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['material', 'adjustment_type', 'date', 'performed_by']
    search_fields = ['reason', 'reference']
    ordering_fields = ['date', 'material__name']
    
    def get_permissions(self):
        """
        Custom permissions:
        - Create/update/delete: Admin, Manager or Warehouse Staff
        - List/retrieve: Any authenticated user
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAuthenticated, (IsAdminOrManager | IsWarehouseStaff)]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=False, methods=['get'])
    def material_history(self, request):
        """Get adjustment history for a specific material."""
        material_id = request.query_params.get('material_id', None)
        if not material_id:
            return Response(
                {'error': _('material_id parameter is required')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            material = Material.objects.get(pk=material_id)
        except Material.DoesNotExist:
            return Response(
                {'error': _('Material not found')},
                status=status.HTTP_404_NOT_FOUND
            )
        
        adjustments = StockAdjustment.objects.filter(material=material).order_by('-date')
        page = self.paginate_queryset(adjustments)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(adjustments, many=True)
        return Response(serializer.data)


class MaterialLocationViewSet(viewsets.ModelViewSet):
    """API endpoints for material locations."""
    
    queryset = MaterialLocation.objects.all()
    serializer_class = MaterialLocationSerializer
    permission_classes = [IsAuthenticated, (IsAdminOrManager | IsWarehouseStaff)]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['material', 'warehouse', 'zone', 'is_primary']
    search_fields = ['warehouse', 'zone', 'rack', 'shelf', 'bin']
    ordering_fields = ['material__name', 'warehouse', 'zone']
    
    @action(detail=False, methods=['get'])
    def material_locations(self, request):
        """Get all locations for a specific material."""
        material_id = request.query_params.get('material_id', None)
        if not material_id:
            return Response(
                {'error': _('material_id parameter is required')},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        locations = MaterialLocation.objects.filter(material_id=material_id)
        serializer = self.get_serializer(locations, many=True)
        return Response(serializer.data)