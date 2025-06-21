# dashboard/views.py
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, F, Count, Q
from django.utils import timezone

from inventory.models import Material, Category
from sales.models import SaleItem
from purchases.models import PurchaseOrderItem
from expenses.models import Expense
from users.models import UserActivity
from users.permissions import IsAdminOrManagerOrReadOnly
from customers.models import Customer
from suppliers.models import Supplier
from debts.models import Debt

class DashboardViewSet(viewsets.ViewSet):
    """
    Dashboard endpoints:
      - inventory-value
      - top-selling-materials
      - recent-activities
      - monthly-summary
    """
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]

    @action(detail=False, methods=['get'], url_path='inventory-value')
    def inventory_value(self, request):
        """
        Total stock value = sum(quantity_in_stock * price_per_unit)
        """
        total = Material.objects.aggregate(
            total_value=Sum(F('quantity_in_stock') * F('price_per_unit'))
        )['total_value'] or 0
        return Response({'total_inventory_value': total})
    # Aggregating on `quantity_in_stock` and `price_per_unit` fields :contentReference[oaicite:0]{index=0}

    @action(detail=False, methods=['get'], url_path='top-selling-materials')
    def top_selling_materials(self, request):
        """
        Top-selling materials by quantity.
        Optional ?limit=<n> (default 5)
        """
        limit = int(request.query_params.get('limit', 5))
        qs = SaleItem.objects.values(
                'material__id', 'material__name'
            ).annotate(
                total_sold=Sum('quantity'),
                revenue=Sum(F('quantity') * F('price'))
            ).order_by('-total_sold')[:limit]
        return Response(qs)

    @action(detail=False, methods=['get'], url_path='recent-activities')
    def recent_activities(self, request):
        """
        Latest user actions.
        Optional ?limit=<n> (default 10)
        """
        limit = int(request.query_params.get('limit', 10))
        activities = UserActivity.objects.all().order_by('-action_time')[:limit]
        data = [{
            'user': act.user.email,
            'action': act.action,
            'module': act.module,
            'description': act.description,
            'timestamp': act.action_time
        } for act in activities]
        return Response(data)

    @action(detail=False, methods=['get'], url_path='monthly-summary')
    def monthly_summary(self, request):
        """
        Monthly summary for sales, purchases, and expenses.
        Optional ?year=<YYYY> (defaults to current year)
        Returns:
          {
            "year": 2025,
            "labels": ["Jan", "Feb", ...],
            "sales": [...],
            "purchases": [...],
            "expenses": [...]
          }
        """
        year = int(request.query_params.get('year', timezone.now().year))
        # init containers
        summary = {m: {'sales': 0, 'purchases': 0, 'expenses': 0} for m in range(1,13)}

        # Sales items
        for item in SaleItem.objects.select_related('sale').filter(sale__sale_date__year=year):
            m = item.sale.sale_date.month
            summary[m]['sales'] += item.quantity * item.price

        # Purchase items
        for item in PurchaseOrderItem.objects.select_related('purchase_order').filter(
                purchase_order__created_at__year=year):
            m = item.purchase_order.created_at.month
            summary[m]['purchases'] += item.quantity * item.price

        # Expenses
        for exp in Expense.objects.filter(date__year=year):
            m = exp.date.month
            summary[m]['expenses'] += exp.amount

        # Build chart-friendly arrays
        labels = [timezone.datetime(year, m, 1).strftime('%b') for m in range(1,13)]
        sales = [summary[m]['sales'] for m in range(1,13)]
        purchases = [summary[m]['purchases'] for m in range(1,13)]
        expenses = [summary[m]['expenses'] for m in range(1,13)]

        return Response({
            'year': year,
            'labels': labels,
            'sales': sales,
            'purchases': purchases,
            'expenses': expenses
        })

    @action(detail=False, methods=['get'], url_path='summary-counts')
    def summary_counts(self, request):
        """
        Get summary counts for dashboard quick stats:
        - Total customers
        - Total suppliers  
        - Material categories count
        - Low stock materials count
        """
        # Get counts
        total_customers = Customer.objects.filter(status='active').count()
        total_suppliers = Supplier.objects.filter(is_active=True).count()
        total_categories = Category.objects.filter(is_active=True).count()
        
        # Low stock materials (where quantity <= reorder_level)
        low_stock_count = Material.objects.filter(
            is_active=True,
            quantity_in_stock__lte=F('reorder_level')
        ).count()
        
        return Response({
            'total_customers': total_customers,
            'total_suppliers': total_suppliers,
            'total_categories': total_categories,
            'low_stock_items': low_stock_count
        })

    @action(detail=False, methods=['get'], url_path='debt-summary')
    def debt_summary(self, request):
        """
        Get debt summary for dashboard:
        - Total outstanding debt amount
        - Number of overdue debts
        - Recent debt activities
        """
        # Get debt statistics
        active_debts = Debt.objects.filter(is_deleted=False)
        
        total_debt_amount = active_debts.aggregate(
            total=Sum('total_amount')
        )['total'] or 0
        
        outstanding_amount = sum(
            debt.remaining_amount for debt in active_debts
        )
        
        overdue_debts = active_debts.filter(
            due_date__lt=timezone.now().date(),
            status__in=[Debt.PENDING, Debt.PARTIALLY_PAID]
        )
        overdue_count = overdue_debts.count()
        overdue_amount = sum(debt.remaining_amount for debt in overdue_debts)
        
        # Debt status distribution
        status_counts = {
            'pending': active_debts.filter(status=Debt.PENDING).count(),
            'overdue': overdue_count,
            'partially_paid': active_debts.filter(status=Debt.PARTIALLY_PAID).count(),
            'paid': active_debts.filter(status=Debt.PAID).count(),
        }
        
        # Recent debt activities (last 5)
        recent_debts = active_debts.select_related('customer').order_by('-created_at')[:5]
        recent_activities = []
        for debt in recent_debts:
            recent_activities.append({
                'id': debt.id,
                'customer_name': debt.customer.name,
                'amount': float(debt.total_amount),
                'remaining_amount': float(debt.remaining_amount),
                'status': debt.status,
                'due_date': debt.due_date,
                'created_at': debt.created_at,
                'is_overdue': debt.is_overdue
            })
        
        return Response({
            'total_debt_amount': float(total_debt_amount),
            'outstanding_amount': float(outstanding_amount),
            'overdue_count': overdue_count,
            'overdue_amount': float(overdue_amount),
            'status_distribution': status_counts,
            'recent_activities': recent_activities,
            'collection_rate': (
                ((total_debt_amount - outstanding_amount) / total_debt_amount * 100) 
                if total_debt_amount > 0 else 0
            )
        })

    @action(detail=False, methods=['get'], url_path='inventory-status')
    def inventory_status(self, request):
        """
        Get inventory status for dashboard table:
        - Material name, stock quantity, status, and value
        - Limit to top materials (default 5)
        """
        # Handle both DRF and regular Django requests
        if hasattr(request, 'query_params'):
            limit = int(request.query_params.get('limit', 5))
        else:
            limit = int(request.GET.get('limit', 5))
        
        # Get materials with stock information
        materials = Material.objects.filter(is_active=True).select_related(
            'category', 'unit'
        ).order_by('-quantity_in_stock')[:limit]
        
        inventory_data = []
        for material in materials:
            # Calculate stock status
            if material.quantity_in_stock <= 0:
                status = 'Critical'
            elif material.quantity_in_stock <= material.reorder_level:
                status = 'Low'
            elif material.quantity_in_stock <= (material.reorder_level * 2):
                status = 'Medium'
            else:
                status = 'Good'
            
            # Calculate total value (quantity * price)
            total_value = float(material.quantity_in_stock) * float(material.price_per_unit)
            
            inventory_data.append({
                'id': material.id,
                'material': material.name,
                'sku': material.sku,
                'category': material.category.name,
                'stock': float(material.quantity_in_stock),
                'unit': material.unit.abbreviation,
                'status': status,
                'value': total_value,
                'price_per_unit': float(material.price_per_unit),
                'reorder_level': float(material.reorder_level)
            })
        
        return Response({
            'inventory_status': inventory_data,
            'total_materials': Material.objects.filter(is_active=True).count(),
            'low_stock_count': Material.objects.filter(
                is_active=True,
                quantity_in_stock__lte=F('reorder_level')
            ).count()
        })
