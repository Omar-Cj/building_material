# users/models.py

from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils.translation import gettext_lazy as _
from django.core.validators import RegexValidator

class UserManager(BaseUserManager):
    """Custom user manager for the User model."""
    
    def create_user(self, email, password=None, **extra_fields):
        """Create and save a regular user with the given email and password."""
        if not email:
            raise ValueError(_('The Email field must be set'))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user
    
    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser with the given email and password."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', User.ADMIN)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))
        
        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    """Custom User model with email as the unique identifier."""
    
    # Role choices
    ADMIN = 'admin'
    MANAGER = 'manager'
    WAREHOUSE_STAFF = 'warehouse_staff'
    CUSTOMER = 'customer'
    
    ROLE_CHOICES = [
        (ADMIN, _('Admin')),
        (MANAGER, _('Manager')),
        (WAREHOUSE_STAFF, _('Warehouse Staff')),
        (CUSTOMER, _('Customer')),
    ]
    
    # Fields
    username = None  # Remove username field
    email = models.EmailField(_('email address'), unique=True)
    phone = models.CharField(
        max_length=15,
        validators=[RegexValidator(r'^\+?1?\d{9,15}$', _('Enter a valid phone number.'))],
        blank=True,
        null=True
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=CUSTOMER)
    address = models.TextField(blank=True, null=True)
    profile_picture = models.ImageField(upload_to='profile_pics/', blank=True, null=True)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    # Set email as the username field for authentication
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    
    objects = UserManager()
    
    def __str__(self):
        return self.email
    
    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')


class UserActivity(models.Model):
    """Track user activities in the system."""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    action = models.CharField(max_length=255)
    action_time = models.DateTimeField(auto_now_add=True)
    module = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    
    class Meta:
        ordering = ['-action_time']
        verbose_name = _('user activity')
        verbose_name_plural = _('user activities')
    
    def __str__(self):
        return f"{self.user.email} - {self.action} - {self.action_time}"