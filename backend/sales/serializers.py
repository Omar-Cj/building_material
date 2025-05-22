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
            'total_amount', 'payment_method', 'created_by',
            'updated_by', 'items'
        ]
        read_only_fields = ['id', 'sale_date', 'total_amount', 'created_by', 'updated_by']

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required.")
        return value

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
