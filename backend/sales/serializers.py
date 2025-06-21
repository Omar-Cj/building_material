# sales/serializers.py
from rest_framework import serializers
from django.db import transaction
from .models import Sale, SaleItem
from inventory.models import Material

class SaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = ['id', 'material', 'quantity', 'price']

class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True)

    class Meta:
        model = Sale
        fields = [
            'id', 'customer', 'sale_date', 'tax', 'discount',
            'total_amount', 'payment_method', 'payment_status', 'due_date',
            'created_by', 'updated_by', 'items'
        ]
        read_only_fields = ['id', 'sale_date', 'total_amount', 'created_by', 'updated_by']

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required.")
        return value
    
    def validate(self, data):
        """Custom validation for sales, including credit limit checks."""
        customer = data.get('customer')
        payment_method = data.get('payment_method')
        items = data.get('items', [])
        
        # Calculate total amount - use Decimal for consistency
        from decimal import Decimal
        
        total = Decimal('0')
        for item in items:
            quantity = Decimal(str(item['quantity']))
            price = Decimal(str(item['price']))
            total += quantity * price
        
        # Add tax, subtract discount
        tax = Decimal(str(data.get('tax', 0)))
        discount = Decimal(str(data.get('discount', 0)))
        total += tax
        total -= discount
        
        # Credit sale validation
        if payment_method == Sale.CREDIT:
            # Require due_date for credit sales
            if not data.get('due_date'):
                raise serializers.ValidationError("Due date is required for credit sales.")
            
            # Check customer credit limit
            if customer and customer.credit_limit > 0:
                current_outstanding = Decimal(str(customer.outstanding_balance or 0))
                credit_limit = Decimal(str(customer.credit_limit))
                
                if current_outstanding + total > credit_limit:
                    available_credit = credit_limit - current_outstanding
                    raise serializers.ValidationError(
                        f"This sale would exceed customer's credit limit of ${float(credit_limit):,.2f}. "
                        f"Current outstanding: ${float(current_outstanding):,.2f}, Sale amount: ${float(total):,.2f}, "
                        f"Available credit: ${float(available_credit):,.2f}"
                    )
            
            # Set payment status for credit sales
            data['payment_status'] = Sale.PENDING
        else:
            # For non-credit sales, payment is considered complete
            data['payment_status'] = Sale.PAID
            # Clear due_date for non-credit sales
            data['due_date'] = None
        
        return data

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        user = self.context['request'].user

        # initial create to get an ID
        sale = Sale.objects.create(**validated_data, created_by=user)
        total = 0
        for item in items_data:
            mat = Material.objects.select_for_update().get(pk=item['material'].id)
            if mat.quantity_in_stock < item['quantity']:
                raise serializers.ValidationError(
                    f"Insufficient stock for {mat.name}."
                )
            # decrement stock
            mat.quantity_in_stock -= item['quantity']
            mat.save()

            # create line item
            line = SaleItem.objects.create(
                sale=sale,
                material=mat,
                quantity=item['quantity'],
                price=item['price']
            )
            total += line.quantity * line.price

        # compute and save total_amount
        sale.total_amount = total + sale.tax - sale.discount
        sale.save(update_fields=['total_amount'])
        return sale

    @transaction.atomic
    def update(self, instance, validated_data):
        # simple approach: restore previous stock, then reapply new items
        old_items = list(instance.items.all())
        for old in old_items:
            mat = Material.objects.select_for_update().get(pk=old.material_id)
            mat.quantity_in_stock += old.quantity
            mat.save()
        instance.items.all().delete()

        # update fields
        for attr, val in validated_data.items():
            if attr != 'items':
                setattr(instance, attr, val)
        instance.save()

        # recreate items & decrement stock
        total = 0
        for item in validated_data.get('items', []):
            mat = Material.objects.select_for_update().get(pk=item['material'].id)
            if mat.quantity_in_stock < item['quantity']:
                raise serializers.ValidationError(
                    f"Insufficient stock for {mat.name}."
                )
            mat.quantity_in_stock -= item['quantity']
            mat.save()
            line = SaleItem.objects.create(
                sale=instance,
                material=mat,
                quantity=item['quantity'],
                price=item['price']
            )
            total += line.quantity * line.price

        instance.total_amount = total + instance.tax - instance.discount
        instance.save(update_fields=['total_amount'])
        return instance
