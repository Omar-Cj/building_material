# dashboard/views.py
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, F
from django.utils import timezone

from inventory.models import Material
from sales.models import SaleItem
from purchases.models import PurchaseOrderItem
from expenses.models import Expense
from users.models import UserActivity
from users.permissions import IsAdminOrManagerOrReadOnly

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
