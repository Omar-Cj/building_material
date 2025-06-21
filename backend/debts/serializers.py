from rest_framework import serializers
from django.utils import timezone
from .models import Debt, DebtPayment, DebtReminder
from customers.models import Customer
from sales.models import Sale


class DebtSerializer(serializers.ModelSerializer):
    """Serializer for Debt model."""
    
    # Read-only calculated fields
    remaining_amount = serializers.ReadOnlyField()
    is_overdue = serializers.ReadOnlyField()
    days_overdue = serializers.ReadOnlyField()
    payment_percentage = serializers.ReadOnlyField()
    interest_amount = serializers.SerializerMethodField()
    
    # Material-related fields
    materials_count = serializers.ReadOnlyField()
    materials_summary = serializers.ReadOnlyField()
    material_breakdown = serializers.SerializerMethodField()
    
    # Related field details
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone', read_only=True)
    customer_email = serializers.CharField(source='customer.email', read_only=True)
    sale_id = serializers.IntegerField(source='sale.id', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = Debt
        fields = [
            'id', 'customer', 'customer_name', 'customer_phone', 'customer_email',
            'sale', 'sale_id', 'total_amount', 'paid_amount', 'remaining_amount',
            'interest_rate', 'interest_amount', 'created_at', 'due_date',
            'last_payment_date', 'status', 'priority', 'payment_terms',
            'notes', 'is_overdue', 'days_overdue', 'payment_percentage',
            'materials_count', 'materials_summary', 'material_breakdown',
            'created_by', 'created_by_name', 'updated_by', 'updated_at', 'is_deleted'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'last_payment_date', 
            'remaining_amount', 'is_overdue', 'days_overdue', 'payment_percentage'
        ]
    
    def get_interest_amount(self, obj):
        """Calculate current interest amount."""
        return obj.calculate_interest()
    
    def get_material_breakdown(self, obj):
        """Get detailed breakdown of materials in this debt."""
        return obj.get_material_breakdown()
    
    def validate(self, data):
        """Custom validation for debt creation/update."""
        customer = data.get('customer')
        total_amount = data.get('total_amount', 0)
        
        # Check customer credit limit using Decimal for consistency
        if customer and customer.credit_limit and customer.credit_limit > 0:
            from decimal import Decimal
            
            current_outstanding = Decimal(str(customer.outstanding_balance or 0))
            total_amount_decimal = Decimal(str(total_amount))
            credit_limit = Decimal(str(customer.credit_limit))
            
            if self.instance:
                # If updating, subtract current debt amount
                current_outstanding -= Decimal(str(self.instance.remaining_amount))
            
            if current_outstanding + total_amount_decimal > credit_limit:
                raise serializers.ValidationError(
                    f"This debt would exceed customer's credit limit of ${float(credit_limit):,.2f}. "
                    f"Current outstanding: ${float(current_outstanding):,.2f}, Requested: ${float(total_amount_decimal):,.2f}"
                )
        
        # Validate due date is not in the past
        due_date = data.get('due_date')
        if due_date and due_date < timezone.now().date():
            raise serializers.ValidationError("Due date cannot be in the past.")
        
        # Validate paid amount doesn't exceed total amount
        paid_amount = data.get('paid_amount', 0)
        if paid_amount > total_amount:
            raise serializers.ValidationError("Paid amount cannot exceed total amount.")
        
        return data
    
    def create(self, validated_data):
        """Override create to update customer outstanding balance."""
        debt = super().create(validated_data)
        
        # Update customer outstanding balance
        customer = debt.customer
        customer.outstanding_balance += debt.remaining_amount
        customer.save()
        
        return debt
    
    def update(self, instance, validated_data):
        """Override update to handle balance changes."""
        old_remaining = instance.remaining_amount
        debt = super().update(instance, validated_data)
        new_remaining = debt.remaining_amount
        
        # Update customer outstanding balance
        if old_remaining != new_remaining:
            customer = debt.customer
            customer.outstanding_balance = customer.outstanding_balance - old_remaining + new_remaining
            customer.save()
        
        return debt


class DebtPaymentSerializer(serializers.ModelSerializer):
    """Serializer for DebtPayment model."""
    
    # Related field details
    debt_info = serializers.SerializerMethodField()
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    received_by_name = serializers.CharField(source='received_by.username', read_only=True)
    
    class Meta:
        model = DebtPayment
        fields = [
            'id', 'debt', 'debt_info', 'customer', 'customer_name',
            'amount', 'payment_method', 'payment_date', 'reference_number',
            'receipt_number', 'status', 'notes', 'received_by', 'received_by_name',
            'created_at', 'updated_at', 'updated_by', 'is_deleted'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_debt_info(self, obj):
        """Get basic debt information."""
        return {
            'id': obj.debt.id,
            'total_amount': obj.debt.total_amount,
            'remaining_amount': obj.debt.remaining_amount,
            'status': obj.debt.status
        }
    
    def validate(self, data):
        """Custom validation for debt payments."""
        debt = data.get('debt')
        amount = data.get('amount', 0)
        
        if debt:
            # Check if payment amount doesn't exceed remaining debt
            if amount > debt.remaining_amount:
                raise serializers.ValidationError(
                    f"Payment amount (${amount}) cannot exceed remaining debt amount (${debt.remaining_amount})"
                )
            
            # Check if debt is already paid
            if debt.status == Debt.PAID:
                raise serializers.ValidationError("Cannot add payment to an already paid debt.")
            
            # Check if debt is cancelled
            if debt.status == Debt.CANCELLED:
                raise serializers.ValidationError("Cannot add payment to a cancelled debt.")
        
        # Validate payment amount is positive
        if amount <= 0:
            raise serializers.ValidationError("Payment amount must be greater than zero.")
        
        return data


class DebtReminderSerializer(serializers.ModelSerializer):
    """Serializer for DebtReminder model."""
    
    # Related field details
    debt_info = serializers.SerializerMethodField()
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    
    class Meta:
        model = DebtReminder
        fields = [
            'id', 'debt', 'debt_info', 'customer', 'customer_name',
            'reminder_type', 'scheduled_date', 'sent_date', 'status',
            'message', 'notes', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'sent_date']
    
    def get_debt_info(self, obj):
        """Get basic debt information."""
        return {
            'id': obj.debt.id,
            'total_amount': obj.debt.total_amount,
            'remaining_amount': obj.debt.remaining_amount,
            'due_date': obj.debt.due_date,
            'status': obj.debt.status
        }


class DebtSummarySerializer(serializers.Serializer):
    """Serializer for debt summary reports."""
    
    customer_id = serializers.IntegerField()
    customer_name = serializers.CharField()
    customer_phone = serializers.CharField()
    customer_email = serializers.CharField()
    total_debts = serializers.IntegerField()
    total_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    paid_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    remaining_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    overdue_amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    oldest_debt_date = serializers.DateField()
    latest_payment_date = serializers.DateTimeField()


class CustomerDebtSummarySerializer(serializers.ModelSerializer):
    """Serializer for customer with debt summary."""
    
    debt_summary = serializers.SerializerMethodField()
    
    class Meta:
        model = Customer
        fields = [
            'id', 'name', 'phone', 'email', 'customer_type',
            'credit_limit', 'outstanding_balance', 'status',
            'debt_summary'
        ]
    
    def get_debt_summary(self, obj):
        """Get debt summary for customer."""
        debts = obj.debts.filter(is_deleted=False)
        
        if not debts.exists():
            return {
                'total_debts': 0,
                'total_amount': 0,
                'paid_amount': 0,
                'remaining_amount': 0,
                'overdue_count': 0,
                'overdue_amount': 0
            }
        
        overdue_debts = debts.filter(status=Debt.OVERDUE)
        
        return {
            'total_debts': debts.count(),
            'total_amount': sum(debt.total_amount for debt in debts),
            'paid_amount': sum(debt.paid_amount for debt in debts),
            'remaining_amount': sum(debt.remaining_amount for debt in debts),
            'overdue_count': overdue_debts.count(),
            'overdue_amount': sum(debt.remaining_amount for debt in overdue_debts)
        }


class CreateCreditSaleSerializer(serializers.Serializer):
    """Serializer for creating a credit sale (sale + debt in one transaction)."""
    
    # Sale fields
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.all())
    items = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField()
        ),
        write_only=True
    )
    tax = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Debt fields
    due_date = serializers.DateField()
    interest_rate = serializers.DecimalField(max_digits=5, decimal_places=2, default=0)
    payment_terms = serializers.CharField(max_length=255, required=False)
    notes = serializers.CharField(required=False)
    
    def validate(self, data):
        """Validate credit sale data."""
        customer = data['customer']
        items = data['items']
        
        # Calculate total amount using Decimal for consistency
        from decimal import Decimal
        
        total_amount = Decimal('0')
        for item in items:
            quantity = Decimal(str(item['quantity']))
            price = Decimal(str(item['price']))
            total_amount += quantity * price
        
        # Add tax, subtract discount
        tax = Decimal(str(data.get('tax', 0)))
        discount = Decimal(str(data.get('discount', 0)))
        total_amount += tax
        total_amount -= discount
        
        # Check customer credit limit
        if customer.credit_limit and customer.credit_limit > 0:
            outstanding_balance = Decimal(str(customer.outstanding_balance or 0))
            credit_limit = Decimal(str(customer.credit_limit))
            
            if outstanding_balance + total_amount > credit_limit:
                raise serializers.ValidationError(
                    f"This sale would exceed customer's credit limit of ${float(credit_limit):,.2f}. "
                    f"Current outstanding: ${float(outstanding_balance):,.2f}, Sale amount: ${float(total_amount):,.2f}"
                )
        
        # Validate due date
        due_date = data['due_date']
        if due_date <= timezone.now().date():
            raise serializers.ValidationError("Due date must be in the future.")
        
        data['calculated_total'] = float(total_amount)
        return data