# customers/serializers.py

from rest_framework import serializers
from .models import Customer, CustomerContact, CustomerShippingAddress, CustomerPayment


class CustomerContactSerializer(serializers.ModelSerializer):
    """Serializer for CustomerContact model."""
    
    class Meta:
        model = CustomerContact
        fields = ['id', 'customer', 'name', 'position', 'email', 'phone', 
                  'is_primary', 'notes']


class CustomerShippingAddressSerializer(serializers.ModelSerializer):
    """Serializer for CustomerShippingAddress model."""
    
    class Meta:
        model = CustomerShippingAddress
        fields = ['id', 'customer', 'address_name', 'address', 'city', 'state', 
                  'postal_code', 'country', 'contact_person', 'phone', 
                  'is_default', 'is_active']


class CustomerPaymentSerializer(serializers.ModelSerializer):
    """Serializer for CustomerPayment model."""
    
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    received_by_name = serializers.CharField(source='received_by.get_full_name', read_only=True)
    
    class Meta:
        model = CustomerPayment
        fields = ['id', 'customer', 'customer_name', 'sale', 'amount', 
                  'payment_method', 'payment_date', 'reference_number', 
                  'status', 'notes', 'received_by', 'received_by_name']
        read_only_fields = ['payment_date', 'received_by']
    
    def create(self, validated_data):
        """Create payment and record who received it."""
        validated_data['received_by'] = self.context['request'].user
        return super().create(validated_data)


class CustomerSerializer(serializers.ModelSerializer):
    """Serializer for Customer model."""
    
    class Meta:
        model = Customer
        fields = ['id', 'name', 'customer_type', 'contact_person', 'email', 
                  'phone', 'alternative_phone', 'tax_id', 'credit_limit', 
                  'outstanding_balance', 'payment_terms', 'allow_debt', 'current_debt', 
                  'debt_limit', 'debt_status', 'status', 'registration_date', 'notes', 
                  'created_at', 'updated_at', 'created_by', 'updated_by', 'user_account']
        read_only_fields = ['created_at', 'updated_at', 'created_by', 
                            'updated_by', 'registration_date', 'outstanding_balance']
    
    def create(self, validated_data):
        """Create a new customer and record who created it."""
        user = self.context['request'].user
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Update a customer and record who updated it."""
        user = self.context['request'].user
        validated_data['updated_by'] = user
        return super().update(instance, validated_data)


class CustomerDetailSerializer(CustomerSerializer):
    """Detailed serializer for Customer model."""
    
    contacts = CustomerContactSerializer(many=True, read_only=True)
    shipping_addresses = CustomerShippingAddressSerializer(many=True, read_only=True)
    payments = CustomerPaymentSerializer(many=True, read_only=True)
    
    class Meta(CustomerSerializer.Meta):
        fields = CustomerSerializer.Meta.fields + ['contacts', 'shipping_addresses', 'payments']