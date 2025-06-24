# customers/models.py

from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from django.core.validators import MinValueValidator


class Customer(models.Model):
    """Model for customers."""
    
    # Customer types
    INDIVIDUAL = 'individual'
    COMPANY = 'company'
    GOVERNMENT = 'government'
    NGO = 'ngo'
    
    CUSTOMER_TYPE_CHOICES = [
        (INDIVIDUAL, _('Individual')),
        (COMPANY, _('Company')),
        (GOVERNMENT, _('Government')),
        (NGO, _('NGO/Non-profit')),
    ]
    
    # Customer status
    ACTIVE = 'active'
    INACTIVE = 'inactive'
    BLACKLISTED = 'blacklisted'
    
    STATUS_CHOICES = [
        (ACTIVE, _('Active')),
        (INACTIVE, _('Inactive')),
        (BLACKLISTED, _('Blacklisted')),
    ]
    
    # Customer fields
    name = models.CharField(max_length=255)
    customer_type = models.CharField(max_length=20, choices=CUSTOMER_TYPE_CHOICES, default=INDIVIDUAL)
    contact_person = models.CharField(max_length=255, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20)
    alternative_phone = models.CharField(max_length=20, blank=True, null=True)
    tax_id = models.CharField(max_length=50, blank=True, null=True)
    
    # Financial information
    credit_limit = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0)]
    )
    outstanding_balance = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0
    )
    payment_terms = models.CharField(max_length=255, blank=True, null=True)
    allow_debt = models.BooleanField(default=False)
    current_debt = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0)]
    )
    debt_limit = models.DecimalField(
        max_digits=12, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0)]
    )
    
    # Debt status choices
    DEBT_ACTIVE = 'active'
    DEBT_SUSPENDED = 'suspended' 
    DEBT_CLEARED = 'cleared'
    
    DEBT_STATUS_CHOICES = [
        (DEBT_ACTIVE, _('Active')),
        (DEBT_SUSPENDED, _('Suspended')),
        (DEBT_CLEARED, _('Cleared')),
    ]
    
    debt_status = models.CharField(max_length=20, choices=DEBT_STATUS_CHOICES, default=DEBT_CLEARED)
    
    # Status and metadata
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=ACTIVE)
    registration_date = models.DateField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_customers'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='updated_customers'
    )
    
    # Connect to user account if applicable
    user_account = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_profile'
    )
    
    class Meta:
        verbose_name = _('customer')
        verbose_name_plural = _('customers')
        ordering = ['name']
    
    def __str__(self):
        return self.name


class CustomerContact(models.Model):
    """Model for additional customer contacts."""
    
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='contacts')
    name = models.CharField(max_length=255)
    position = models.CharField(max_length=100, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    phone = models.CharField(max_length=20)
    is_primary = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = _('customer contact')
        verbose_name_plural = _('customer contacts')
        ordering = ['-is_primary', 'name']
    
    def __str__(self):
        return f"{self.name} - {self.customer.name}"


class CustomerShippingAddress(models.Model):
    """Model for customer shipping addresses."""
    
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='shipping_addresses')
    address_name = models.CharField(max_length=100)  # E.g., "Main Warehouse", "Branch Office"
    address = models.TextField()
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100)
    contact_person = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = _('shipping address')
        verbose_name_plural = _('shipping addresses')
        ordering = ['-is_default', 'address_name']
    
    def __str__(self):
        return f"{self.customer.name} - {self.address_name}"


class CustomerPayment(models.Model):
    """Model for tracking customer payments."""
    
    # Payment methods
    CASH = 'cash'
    BANK_TRANSFER = 'bank_transfer'
    CHECK = 'check'
    CREDIT_CARD = 'credit_card'
    MOBILE_PAYMENT = 'mobile_payment'
    OTHER = 'other'
    
    PAYMENT_METHOD_CHOICES = [
        (CASH, _('Cash')),
        (BANK_TRANSFER, _('Bank Transfer')),
        (CHECK, _('Check')),
        (CREDIT_CARD, _('Credit Card')),
        (MOBILE_PAYMENT, _('Mobile Payment')),
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
    
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='payments')
    sale = models.ForeignKey('sales.Sale', on_delete=models.SET_NULL, null=True, blank=True, related_name='payments')
    amount = models.DecimalField(
        max_digits=12, 
        decimal_places=2,
        validators=[MinValueValidator(0)]
    )
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    payment_date = models.DateTimeField(auto_now_add=True)
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default=COMPLETED)
    notes = models.TextField(blank=True, null=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='received_payments'
    )
    
    class Meta:
        verbose_name = _('customer payment')
        verbose_name_plural = _('customer payments')
        ordering = ['-payment_date']
    
    def __str__(self):
        return f"{self.customer.name} - {self.amount} - {self.payment_date}"