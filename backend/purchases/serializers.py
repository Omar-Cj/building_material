from rest_framework import serializers
from .models import PurchaseOrder, PurchaseOrderItem

class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderItem
        fields = ['id', 'material', 'quantity', 'price']

class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True)

    class Meta:
        model = PurchaseOrder
        fields = ['id', 'supplier', 'status', 'invoice', 'created_by',
                  'created_at', 'updated_at', 'received_at', 'items']
        read_only_fields = ['created_by', 'created_at', 'updated_at', 'received_at']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        purchase = PurchaseOrder.objects.create(
            **validated_data, created_by=self.context['request'].user
        )
        for itm in items_data:
            PurchaseOrderItem.objects.create(purchase_order=purchase, **itm)
        return purchase

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, val in validated_data.items(): setattr(instance, attr, val)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for itm in items_data:
                PurchaseOrderItem.objects.create(purchase_order=instance, **itm)
        return instance