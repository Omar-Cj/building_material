from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from inventory.models import Material
from suppliers.models import Supplier
from django.contrib.auth import get_user_model

User = get_user_model()

class PurchaseOrder(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_RECEIVED = 'received'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING, _('Pending')),
        (STATUS_RECEIVED, _('Received')),
        (STATUS_CANCELLED, _('Cancelled')),
    ]
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='purchase_orders')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    invoice = models.FileField(upload_to='invoices/', null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_purchase_orders')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    received_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)

class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    material = models.ForeignKey(Material, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    price = models.DecimalField(max_digits=12, decimal_places=2)

# Signal to adjust inventory when order is received
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=PurchaseOrder)
def adjust_inventory_on_receive(sender, instance, created, **kwargs):
    if not created and instance.status == PurchaseOrder.STATUS_RECEIVED:
        for item in instance.items.all():
            m = item.material
            m.quantity_in_stock = models.F('quantity_in_stock') + item.quantity
            m.save()