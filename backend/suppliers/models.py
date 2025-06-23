# suppliers/models.py

from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings


class Supplier(models.Model):
    """Model for material suppliers."""
    
    name = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20)
    alternative_phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField()
    city = models.CharField(max_length=100)
    tax_id = models.CharField(max_length=50, blank=True, null=True)
    payment_terms = models.CharField(max_length=255, blank=True, null=True)
    credit_limit = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_suppliers'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='updated_suppliers'
    )
    
    class Meta:
        verbose_name = _('supplier')
        verbose_name_plural = _('suppliers')
        ordering = ['name']
    
    def __str__(self):
        return self.name


class SupplierContact(models.Model):
    """Model for additional supplier contacts."""
    
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='contacts')
    name = models.CharField(max_length=255)
    position = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20)
    is_primary = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = _('supplier contact')
        verbose_name_plural = _('supplier contacts')
        ordering = ['-is_primary', 'name']
    
    def __str__(self):
        return f"{self.name} - {self.supplier.name}"


class SupplierMaterial(models.Model):
    """Model for tracking supplier-specific material information."""
    
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='material_info')
    material = models.ForeignKey('inventory.Material', on_delete=models.CASCADE, related_name='supplier_info')
    supplier_material_code = models.CharField(max_length=100, blank=True, null=True)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    minimum_order_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    lead_time_days = models.PositiveIntegerField(default=1)
    is_preferred = models.BooleanField(default=False)
    last_purchase_date = models.DateField(blank=True, null=True)
    last_purchase_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = _('supplier material')
        verbose_name_plural = _('supplier materials')
        unique_together = ('supplier', 'material')
        ordering = ['supplier', 'material']
    
    def __str__(self):
        return f"{self.supplier.name} - {self.material.name}"