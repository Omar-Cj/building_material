# suppliers/serializers.py

from rest_framework import serializers
from .models import Supplier, SupplierContact, SupplierMaterial


class SupplierContactSerializer(serializers.ModelSerializer):
    """Serializer for SupplierContact model."""
    
    class Meta:
        model = SupplierContact
        fields = ['id', 'supplier', 'name', 'position', 'email', 'phone', 
                  'is_primary', 'notes']


class SupplierMaterialSerializer(serializers.ModelSerializer):
    """Serializer for SupplierMaterial model."""
    
    material_name = serializers.CharField(source='material.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    unit_abbreviation = serializers.CharField(source='material.unit.abbreviation', read_only=True)
    
    class Meta:
        model = SupplierMaterial
        fields = ['id', 'supplier', 'supplier_name', 'material', 'material_name', 
                  'supplier_material_code', 'unit_price', 
                  'minimum_order_quantity', 'lead_time_days', 'is_preferred',
                  'last_purchase_date', 'last_purchase_price', 'notes', 
                  'unit_abbreviation']


class SupplierSerializer(serializers.ModelSerializer):
    """Serializer for Supplier model."""
    
    contacts = SupplierContactSerializer(many=True, read_only=True)
    material_info = SupplierMaterialSerializer(many=True, read_only=True)
    
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'contact_person', 'email', 'phone', 
                  'alternative_phone', 'address', 'city', 'state', 
                  'postal_code', 'country', 'website', 'tax_id', 
                  'payment_terms', 'credit_limit', 'is_active', 'notes', 
                  'created_at', 'updated_at', 'created_by', 'updated_by',
                  'contacts', 'material_info']
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'updated_by']
    
    def create(self, validated_data):
        """Create a new supplier and record who created it."""
        user = self.context['request'].user
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Update a supplier and record who updated it."""
        user = self.context['request'].user
        validated_data['updated_by'] = user
        return super().update(instance, validated_data)


class SupplierDetailSerializer(SupplierSerializer):
    """Detailed Serializer for Supplier model."""
    
    # Using nested serializers for more detailed views
    contacts = SupplierContactSerializer(many=True, read_only=True)
    material_info = SupplierMaterialSerializer(many=True, read_only=True)