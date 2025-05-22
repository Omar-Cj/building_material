# inventory/models.py

from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from django.db.models.signals import post_save
from django.dispatch import receiver

# We'll reference User model but need to use settings.AUTH_USER_MODEL
# to avoid circular imports
from django.conf import settings

class Category(models.Model):
    """Model for material categories."""
    
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subcategories')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('category')
        verbose_name_plural = _('categories')
        ordering = ['name']
    
    def __str__(self):
        return self.name


class UnitOfMeasure(models.Model):
    """Model for units of measurement for materials."""
    
    name = models.CharField(max_length=50, unique=True)
    abbreviation = models.CharField(max_length=10)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = _('unit of measure')
        verbose_name_plural = _('units of measure')
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} ({self.abbreviation})"


class Material(models.Model):
    """Model for building materials."""
    
    # Basic information
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='materials')
    brand = models.CharField(max_length=100, blank=True, null=True)
    unit = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, related_name='materials')
    
    # Inventory information
    quantity_in_stock = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0, 
        validators=[MinValueValidator(0)]
    )
    reorder_level = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0, 
        validators=[MinValueValidator(0)]
    )
    reorder_quantity = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0, 
        validators=[MinValueValidator(0)]
    )
    
    # Pricing
    price_per_unit = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(0)]
    )
    cost_per_unit = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(0)]
    )
    
    # Relations
    main_supplier = models.ForeignKey('suppliers.Supplier', on_delete=models.SET_NULL, null=True, blank=True, related_name='supplied_materials')
    alternative_suppliers = models.ManyToManyField('suppliers.Supplier', blank=True, related_name='alternative_materials')
    
    # Metadata
    is_active = models.BooleanField(default=True)
    image = models.ImageField(upload_to='materials/', blank=True, null=True)
    barcode = models.CharField(max_length=100, blank=True, null=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='created_materials'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='updated_materials'
    )
    
    class Meta:
        verbose_name = _('material')
        verbose_name_plural = _('materials')
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} - {self.sku}"
    
    @property
    def is_low_stock(self):
        """Check if material is below reorder level."""
        return self.quantity_in_stock <= self.reorder_level
    
    @property
    def stock_value(self):
        """Calculate the current stock value."""
        return self.quantity_in_stock * self.cost_per_unit


class StockAdjustment(models.Model):
    """Model for tracking inventory adjustments."""
    
    ADJUSTMENT_TYPE_CHOICES = [
        ('incoming', _('Incoming')),
        ('outgoing', _('Outgoing')),
        ('loss', _('Loss/Damage')),
        ('return', _('Return')),
        ('correction', _('Correction')),
    ]
    
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name='stock_adjustments')
    adjustment_type = models.CharField(max_length=20, choices=ADJUSTMENT_TYPE_CHOICES)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    previous_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    new_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    reason = models.TextField()
    reference = models.CharField(max_length=100, blank=True, null=True)
    date = models.DateTimeField(auto_now_add=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='stock_adjustments'
    )
    
    class Meta:
        verbose_name = _('stock adjustment')
        verbose_name_plural = _('stock adjustments')
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.material.name} - {self.adjustment_type} - {self.quantity} {self.material.unit.abbreviation}"


class MaterialLocation(models.Model):
    """Model for tracking material storage locations."""
    
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name='locations')
    warehouse = models.CharField(max_length=100)
    zone = models.CharField(max_length=100)
    rack = models.CharField(max_length=100)
    shelf = models.CharField(max_length=100)
    bin = models.CharField(max_length=100)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_primary = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = _('material location')
        verbose_name_plural = _('material locations')
        unique_together = ('material', 'warehouse', 'zone', 'rack', 'shelf', 'bin')
    
    def __str__(self):
        return f"{self.material.name} - {self.warehouse}/{self.zone}/{self.rack}/{self.shelf}/{self.bin}"


# Signal to create a stock adjustment record when material stock changes
@receiver(post_save, sender=Material)
def create_stock_adjustment_on_material_save(sender, instance, created, **kwargs):
    """
    Note: This signal will only be effective for direct changes to the Material model.
    For other stock changes (from sales, purchases, etc.), we'll create adjustments directly.
    """
    if not created and hasattr(instance, '_stock_changed') and instance._stock_changed:
        StockAdjustment.objects.create(
            material=instance,
            adjustment_type='correction',
            quantity=instance.quantity_in_stock - instance._previous_quantity,
            previous_quantity=instance._previous_quantity,
            new_quantity=instance.quantity_in_stock,
            reason='System adjustment',
            performed_by=instance.updated_by
        )
        delattr(instance, '_stock_changed')
        delattr(instance, '_previous_quantity')