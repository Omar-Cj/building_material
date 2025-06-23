from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from django.db.models.signals import post_save
from django.dispatch import receiver
from customers.models import Customer
from sales.models import Sale


class Debt(models.Model):
    """Model for customer debts/credit sales."""
    
    # Debt status choices
    PENDING = 'pending'
    OVERDUE = 'overdue'
    PARTIALLY_PAID = 'partially_paid'
    PAID = 'paid'
    CANCELLED = 'cancelled'
    
    STATUS_CHOICES = [
        (PENDING, _('Pending')),
        (OVERDUE, _('Overdue')),
        (PARTIALLY_PAID, _('Partially Paid')),
        (PAID, _('Paid')),
        (CANCELLED, _('Cancelled')),
    ]
    
    # Priority levels
    LOW = 'low'
    MEDIUM = 'medium'
    HIGH = 'high'
    CRITICAL = 'critical'
    
    PRIORITY_CHOICES = [
        (LOW, _('Low')),
        (MEDIUM, _('Medium')),
        (HIGH, _('High')),
        (CRITICAL, _('Critical')),
    ]
    
    # Core fields
    customer = models.ForeignKey(
        Customer, 
        on_delete=models.PROTECT, 
        related_name='debts',
        help_text=_('Customer who owes this debt')
    )
    sale = models.OneToOneField(
        Sale, 
        on_delete=models.CASCADE, 
        related_name='debt',
        null=True, 
        blank=True,
        help_text=_('Associated sale transaction')
    )
    
    # Financial details
    total_amount = models.DecimalField(
        max_digits=14, 
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text=_('Total debt amount')
    )
    paid_amount = models.DecimalField(
        max_digits=14, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0)],
        help_text=_('Amount already paid')
    )
    interest_rate = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text=_('Annual interest rate percentage')
    )
    
    # Dates
    created_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField(
        help_text=_('Date when payment is due')
    )
    last_payment_date = models.DateTimeField(
        null=True, 
        blank=True,
        help_text=_('Date of last payment received')
    )
    
    # Status and management
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default=PENDING
    )
    priority = models.CharField(
        max_length=20, 
        choices=PRIORITY_CHOICES, 
        default=MEDIUM
    )
    payment_terms = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        help_text=_('Special payment terms or conditions')
    )
    notes = models.TextField(
        blank=True, 
        null=True,
        help_text=_('Additional notes about this debt')
    )
    
    # Audit fields
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_debts'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='updated_debts'
    )
    updated_at = models.DateTimeField(auto_now=True)
    
    # Soft delete
    is_deleted = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = _('debt')
        verbose_name_plural = _('debts')
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['due_date', 'status']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"Debt #{self.id} - {self.customer.name} - ${self.remaining_amount}"
    
    @property
    def remaining_amount(self):
        """Calculate remaining amount to be paid."""
        return self.total_amount - self.paid_amount
    
    @property
    def is_overdue(self):
        """Check if debt is overdue."""
        return self.due_date < timezone.now().date() and self.status not in [self.PAID, self.CANCELLED]
    
    @property
    def days_overdue(self):
        """Calculate number of days overdue."""
        if not self.is_overdue:
            return 0
        return (timezone.now().date() - self.due_date).days
    
    @property
    def payment_percentage(self):
        """Calculate percentage of debt paid."""
        if self.total_amount == 0:
            return 0
        return (self.paid_amount / self.total_amount) * 100
    
    def calculate_interest(self):
        """Calculate interest amount based on time overdue."""
        if not self.is_overdue or self.interest_rate == 0:
            return 0
        
        # Simple interest calculation
        days_overdue = self.days_overdue
        yearly_rate = self.interest_rate / 100
        daily_rate = yearly_rate / 365
        interest = self.remaining_amount * daily_rate * days_overdue
        return round(interest, 2)
    
    def update_status(self):
        """Update debt status based on payment amount and due date."""
        if self.paid_amount >= self.total_amount:
            self.status = self.PAID
        elif self.paid_amount > 0:
            self.status = self.PARTIALLY_PAID
        elif self.is_overdue:
            self.status = self.OVERDUE
        else:
            self.status = self.PENDING
        self.save()
    
    @property
    def materials(self):
        """Get materials associated with this debt through the sale."""
        if self.sale:
            return self.sale.items.select_related('material', 'material__category', 'material__unit')
        return []
    
    @property
    def materials_count(self):
        """Get count of different materials in this debt."""
        if self.sale:
            return self.sale.items.count()
        return 0
    
    @property
    def materials_summary(self):
        """Get a summary of materials in this debt."""
        if not self.sale:
            return "No associated sale"
        
        materials = []
        for item in self.sale.items.select_related('material'):
            materials.append(f"{item.quantity} {item.material.unit.abbreviation} {item.material.name}")
        
        return ", ".join(materials) if materials else "No materials"
    
    def get_material_breakdown(self):
        """Get detailed breakdown of materials with values."""
        if not self.sale:
            return []
        
        breakdown = []
        for item in self.sale.items.select_related('material', 'material__category', 'material__unit'):
            total_value = item.quantity * item.price
            # Use proper decimal calculation for remaining value
            if self.total_amount > 0:
                remaining_ratio = self.remaining_amount / self.total_amount
                remaining_value = total_value * remaining_ratio
            else:
                remaining_value = 0
                
            breakdown.append({
                'material_id': item.material.id,
                'material_name': item.material.name,
                'category': item.material.category.name,
                'quantity': float(item.quantity),
                'unit': item.material.unit.abbreviation,
                'price_per_unit': float(item.price),
                'total_value': float(total_value),
                'remaining_value': float(remaining_value)
            })
        
        return breakdown


class DebtPayment(models.Model):
    """Model for tracking payments made against debts."""
    
    # Payment methods
    CASH = 'cash'
    BANK_TRANSFER = 'bank_transfer'
    CHECK = 'check'
    CREDIT_CARD = 'credit_card'
    ZAAD = 'zaad'
    EDAHAB = 'edahab'
    OTHER = 'other'
    
    PAYMENT_METHOD_CHOICES = [
        (CASH, _('Cash')),
        (BANK_TRANSFER, _('Bank Transfer')),
        (CHECK, _('Check')),
        (CREDIT_CARD, _('Credit Card')),
        (ZAAD, _('Zaad')),
        (EDAHAB, _('Edahab')),
        (OTHER, _('Other')),
    ]
    
    # Payment status
    PENDING = 'pending'
    COMPLETED = 'completed'
    FAILED = 'failed'
    REFUNDED = 'refunded'
    
    PAYMENT_STATUS_CHOICES = [
        (PENDING, _('Pending')),
        (COMPLETED, _('Completed')),
        (FAILED, _('Failed')),
        (REFUNDED, _('Refunded')),
    ]
    
    # Core fields
    debt = models.ForeignKey(
        Debt, 
        on_delete=models.CASCADE, 
        related_name='payments',
        help_text=_('Debt this payment is for')
    )
    customer = models.ForeignKey(
        Customer, 
        on_delete=models.PROTECT, 
        related_name='debt_payments',
        help_text=_('Customer making the payment')
    )
    
    # Payment details
    amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        help_text=_('Payment amount')
    )
    payment_method = models.CharField(
        max_length=20, 
        choices=PAYMENT_METHOD_CHOICES,
        default=CASH
    )
    payment_date = models.DateTimeField(
        default=timezone.now,
        help_text=_('Date and time when payment was made')
    )
    
    # Reference and tracking
    reference_number = models.CharField(
        max_length=100, 
        blank=True, 
        null=True,
        help_text=_('Bank reference, check number, or transaction ID')
    )
    receipt_number = models.CharField(
        max_length=50, 
        blank=True, 
        null=True,
        help_text=_('Internal receipt number')
    )
    
    # Status and notes
    status = models.CharField(
        max_length=20, 
        choices=PAYMENT_STATUS_CHOICES, 
        default=COMPLETED
    )
    notes = models.TextField(
        blank=True, 
        null=True,
        help_text=_('Additional notes about this payment')
    )
    
    # Audit fields
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='received_debt_payments',
        help_text=_('Staff member who received the payment')
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='updated_debt_payments'
    )
    
    # Soft delete
    is_deleted = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = _('debt payment')
        verbose_name_plural = _('debt payments')
        ordering = ['-payment_date']
        indexes = [
            models.Index(fields=['debt', 'status']),
            models.Index(fields=['customer', 'payment_date']),
            models.Index(fields=['payment_date']),
        ]
    
    def __str__(self):
        return f"Payment #{self.id} - {self.customer.name} - ${self.amount}"
    
    def save(self, *args, **kwargs):
        """Override save to update debt status and customer balance."""
        is_new = self.pk is None
        
        # Call the original save method
        super().save(*args, **kwargs)
        
        # Update debt paid amount and status
        if is_new and self.status == self.COMPLETED:
            self.debt.paid_amount += self.amount
            self.debt.last_payment_date = self.payment_date
            self.debt.update_status()
            
            # Update customer outstanding balance
            self.customer.outstanding_balance -= self.amount
            self.customer.save()
    
    def delete(self, *args, **kwargs):
        """Override delete to update debt and customer balance."""
        if self.status == self.COMPLETED:
            # Reverse the payment effects
            self.debt.paid_amount -= self.amount
            self.debt.update_status()
            
            # Update customer outstanding balance
            self.customer.outstanding_balance += self.amount
            self.customer.save()
        
        super().delete(*args, **kwargs)


class DebtReminder(models.Model):
    """Model for tracking debt payment reminders."""
    
    # Reminder types
    EMAIL = 'email'
    SMS = 'sms'
    PHONE = 'phone'
    LETTER = 'letter'
    
    REMINDER_TYPE_CHOICES = [
        (EMAIL, _('Email')),
        (SMS, _('SMS')),
        (PHONE, _('Phone Call')),
        (LETTER, _('Letter')),
    ]
    
    # Reminder status
    SCHEDULED = 'scheduled'
    SENT = 'sent'
    FAILED = 'failed'
    CANCELLED = 'cancelled'
    
    REMINDER_STATUS_CHOICES = [
        (SCHEDULED, _('Scheduled')),
        (SENT, _('Sent')),
        (FAILED, _('Failed')),
        (CANCELLED, _('Cancelled')),
    ]
    
    debt = models.ForeignKey(
        Debt, 
        on_delete=models.CASCADE, 
        related_name='reminders'
    )
    customer = models.ForeignKey(
        Customer, 
        on_delete=models.PROTECT, 
        related_name='debt_reminders'
    )
    
    reminder_type = models.CharField(
        max_length=20, 
        choices=REMINDER_TYPE_CHOICES
    )
    scheduled_date = models.DateTimeField()
    sent_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20, 
        choices=REMINDER_STATUS_CHOICES, 
        default=SCHEDULED
    )
    
    message = models.TextField(
        help_text=_('Reminder message content')
    )
    notes = models.TextField(blank=True, null=True)
    
    # Audit fields
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_reminders'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = _('debt reminder')
        verbose_name_plural = _('debt reminders')
        ordering = ['-scheduled_date']
    
    def __str__(self):
        return f"Reminder for {self.customer.name} - {self.reminder_type} - {self.scheduled_date}"


# Signal handlers for automatic debt creation
@receiver(post_save, sender=Sale)
def create_debt_for_credit_sale(sender, instance, created, **kwargs):
    """
    Automatically create a debt record when a credit sale is created.
    """
    if created and instance.payment_method == Sale.CREDIT:
        # Check if debt doesn't already exist (to prevent duplicates)
        if not hasattr(instance, 'debt'):
            # Calculate due date (default to 30 days if not provided)
            due_date = instance.due_date
            if not due_date:
                due_date = (instance.sale_date + timedelta(days=30)).date()
            
            # Create the debt record
            debt = Debt.objects.create(
                customer=instance.customer,
                sale=instance,
                total_amount=instance.total_amount,
                due_date=due_date,
                status=Debt.PENDING,
                priority=Debt.MEDIUM,
                created_by=instance.created_by,
                updated_by=instance.created_by,
                notes=f"Auto-created debt for credit sale #{instance.id}"
            )
            
            # Update customer outstanding balance
            instance.customer.outstanding_balance += instance.total_amount
            instance.customer.save()
            
            return debt
    
    # Handle updates to existing credit sales
    elif not created and instance.payment_method == Sale.CREDIT:
        if hasattr(instance, 'debt'):
            debt = instance.debt
            # Update debt amount if sale total changed
            if debt.total_amount != instance.total_amount:
                # Adjust customer balance
                balance_adjustment = instance.total_amount - debt.total_amount
                instance.customer.outstanding_balance += balance_adjustment
                instance.customer.save()
                
                # Update debt
                debt.total_amount = instance.total_amount
                debt.updated_by = instance.updated_by
                debt.update_status()
    
    return None