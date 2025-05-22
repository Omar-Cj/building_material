from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from django.conf import settings
from inventory.models import Material
from customers.models import Customer

class Sale(models.Model):
    CASH = 'cash'
    ZAAD = 'zaad'
    EDAHAB = 'edahab'

    PAYMENT_METHOD_CHOICES = [
        (CASH, _('Cash')),
        (ZAAD, _('Zaad')),
        (EDAHAB, _('Check')),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='sales')
    sale_date = models.DateTimeField(auto_now_add=True)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default=CASH)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_sales')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='updated_sales')
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ['-sale_date']
        verbose_name = _('sale')
        verbose_name_plural = _('sales')

    def __str__(self):
        return f"Sale #{self.id} to {self.customer.name} on {self.sale_date.date()}"
    
class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    material = models.ForeignKey(Material, on_delete=models.PROTECT)
    quantity = models.DecimalField(
        max_digits=10, decimal_places=2,
        validators=[MinValueValidator(0.01)]
    )
    price = models.DecimalField(
        max_digits=12, decimal_places=2,
        validators=[MinValueValidator(0)]
    )

    def __str__(self):
        return f"{self.quantity}× {self.material.name} @ {self.price}"