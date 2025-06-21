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
    CREDIT = 'credit'

    PAYMENT_METHOD_CHOICES = [
        (CASH, _('Cash')),
        (ZAAD, _('Zaad')),
        (EDAHAB, _('Edahab')),
        (CREDIT, _('Credit')),
    ]
    
    # Payment status for credit sales
    PAID = 'paid'
    PENDING = 'pending'
    PARTIAL = 'partial'
    
    PAYMENT_STATUS_CHOICES = [
        (PAID, _('Paid')),
        (PENDING, _('Pending')),
        (PARTIAL, _('Partially Paid')),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='sales')
    sale_date = models.DateTimeField(auto_now_add=True)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    discount = models.DecimalField(max_digits=12, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default=CASH)
    payment_status = models.CharField(
        max_length=20, 
        choices=PAYMENT_STATUS_CHOICES, 
        default=PAID,
        help_text=_('Payment status for credit sales')
    )
    due_date = models.DateField(
        null=True, 
        blank=True,
        help_text=_('Due date for credit sales')
    )
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='created_sales')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='updated_sales')
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ['-sale_date']
        verbose_name = _('sale')
        verbose_name_plural = _('sales')

    def __str__(self):
        return f"Sale #{self.id} to {self.customer.name} on {self.sale_date.date()}"
    
    @property
    def is_credit_sale(self):
        """Check if this is a credit sale."""
        return self.payment_method == self.CREDIT
    
    @property
    def is_overdue(self):
        """Check if credit sale is overdue."""
        if not self.is_credit_sale or not self.due_date:
            return False
        from django.utils import timezone
        return self.due_date < timezone.now().date() and self.payment_status != self.PAID
    
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