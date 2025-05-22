# inventory/serializers.py

from rest_framework import serializers
from .models import Category, UnitOfMeasure, Material, StockAdjustment, MaterialLocation


class CategorySerializer(serializers.ModelSerializer):
    """Serializer for Category model."""
    
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'parent', 'parent_name',
                  'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class UnitOfMeasureSerializer(serializers.ModelSerializer):
    """Serializer for UnitOfMeasure model."""
    
    class Meta:
        model = UnitOfMeasure
        fields = ['id', 'name', 'abbreviation', 'description', 'is_active']


class MaterialLocationSerializer(serializers.ModelSerializer):
    """Serializer for MaterialLocation model."""
    
    class Meta:
        model = MaterialLocation
        fields = ['id', 'material', 'warehouse', 'zone', 'rack', 'shelf', 
                  'bin', 'quantity', 'is_primary']


class MaterialSerializer(serializers.ModelSerializer):
    """Serializer for Material model."""
    
    category_name = serializers.CharField(source='category.name', read_only=True)
    unit_name = serializers.CharField(source='unit.name', read_only=True)
    unit_abbreviation = serializers.CharField(source='unit.abbreviation', read_only=True)
    main_supplier_name = serializers.CharField(source='main_supplier.name', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    stock_value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    locations = MaterialLocationSerializer(many=True, read_only=True)
    
    class Meta:
        model = Material
        fields = ['id', 'name', 'sku', 'description', 'category', 'category_name',
                  'brand', 'unit', 'unit_name', 'unit_abbreviation', 
                  'quantity_in_stock', 'reorder_level', 'reorder_quantity',
                  'price_per_unit', 'cost_per_unit', 'main_supplier', 
                  'main_supplier_name', 'alternative_suppliers', 'is_active',
                  'image', 'barcode', 'created_at', 'updated_at', 
                  'created_by', 'updated_by', 'is_low_stock', 'stock_value',
                  'locations']
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
    
    def create(self, validated_data):
        """Create a new material and record who created it."""
        user = self.context['request'].user
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Update a material and record who updated it."""
        user = self.context['request'].user
        
        # Track stock changes for signal processing
        if 'quantity_in_stock' in validated_data and validated_data['quantity_in_stock'] != instance.quantity_in_stock:
            instance._stock_changed = True
            instance._previous_quantity = instance.quantity_in_stock
        
        validated_data['updated_by'] = user
        return super().update(instance, validated_data)


class StockAdjustmentSerializer(serializers.ModelSerializer):
    """Serializer for StockAdjustment model."""
    
    material_name = serializers.CharField(source='material.name', read_only=True)
    material_sku = serializers.CharField(source='material.sku', read_only=True)
    performer_name = serializers.CharField(source='performed_by.get_full_name', read_only=True)
    unit_abbreviation = serializers.CharField(source='material.unit.abbreviation', read_only=True)
    
    class Meta:
        model = StockAdjustment
        fields = ['id', 'material', 'material_name', 'material_sku', 'adjustment_type',
                  'quantity', 'previous_quantity', 'new_quantity', 'reason',
                  'reference', 'date', 'performed_by', 'performer_name',
                  'unit_abbreviation']
        read_only_fields = ['date', 'performed_by', 'previous_quantity', 'new_quantity']
    
    def create(self, validated_data):
        """Create a new stock adjustment with current user and update material stock."""
        user = self.context['request'].user
        material = validated_data['material']
        quantity = validated_data['quantity']
        adjustment_type = validated_data['adjustment_type']
        
        # Set previous quantity
        validated_data['previous_quantity'] = material.quantity_in_stock
        
        # Update material stock based on adjustment type
        if adjustment_type == 'incoming' or adjustment_type == 'return':
            material.quantity_in_stock += quantity
            new_quantity = material.quantity_in_stock
        elif adjustment_type in ['outgoing', 'loss']:
            if material.quantity_in_stock < quantity:
                raise serializers.ValidationError({
                    'quantity': f'Not enough stock. Current stock: {material.quantity_in_stock}'
                })
            material.quantity_in_stock -= quantity
            new_quantity = material.quantity_in_stock
        else:  # correction
            new_quantity = quantity
            material.quantity_in_stock = new_quantity
        
        # Set new quantity and save material
        validated_data['new_quantity'] = new_quantity
        validated_data['performed_by'] = user
        material.updated_by = user
        material.save()
        
        # Create the adjustment record
        return super().create(validated_data)