# reports/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, F
from django.utils import timezone
from django.http import HttpResponse
import csv
from io import BytesIO
from reportlab.pdfgen import canvas

from inventory.models import Material
from purchases.models import PurchaseOrderItem, PurchaseOrder
from sales.models import SaleItem, Sale
from users.permissions import IsAdminOrManagerOrReadOnly


class ReportViewSet(viewsets.ViewSet):
    """
    A ViewSet for generating various reports.
    """
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend]

    def _parse_dates(self, request):
        start = request.query_params.get('start_date')
        end = request.query_params.get('end_date')
        fmt = '%Y-%m-%d'
        try:
            if start:
                start = timezone.datetime.strptime(start, fmt)
            if end:
                end = timezone.datetime.strptime(end, fmt)
        except ValueError:
            start = end = None
        return start, end

    @action(detail=False, methods=['get'])
    def stock(self, request):
        """
        Current stock levels for all materials.
        """
        qs = Material.objects.all().values(
            'id', 'name', 'category__name', 'unit', 'quantity_in_stock', 'reorder_level'
        )
        return Response(qs)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """
        Materials with quantity_in_stock <= reorder_level.
        """
        qs = Material.objects.filter(
            quantity_in_stock__lte=F('reorder_level')
        ).values(
            'id', 'name', 'quantity_in_stock', 'reorder_level', 'unit'
        )
        return Response(qs)

    @action(detail=False, methods=['get'])
    def sales_purchase_summary(self, request):
        """
        Summarize total sales and total purchases over a date range.
        """
        start, end = self._parse_dates(request)
        sales_qs = SaleItem.objects.select_related('sale').all()
        po_qs    = PurchaseOrderItem.objects.select_related('purchase_order').all()

        if start:
            sales_qs = sales_qs.filter(sale__sale_date__gte=start)
            po_qs    = po_qs.filter(purchase_order__created_at__gte=start)
        if end:
            sales_qs = sales_qs.filter(sale__sale_date__lte=end)
            po_qs    = po_qs.filter(purchase_order__created_at__lte=end)

        total_sales = sales_qs.aggregate(
            revenue=Sum(F('quantity') * F('price'))
        )['revenue'] or 0
        total_purchase = po_qs.aggregate(
            cost=Sum(F('quantity') * F('price'))
        )['cost'] or 0

        return Response({
            'total_sales': total_sales,
            'total_purchases': total_purchase,
            'start_date': start.date() if start else None,
            'end_date': end.date() if end else None,
        })

    @action(detail=False, methods=['get'])
    def export(self, request):
        """
        Export one of the reports as CSV, PDF, or JSON.
        Query params:
          - type: stock | low_stock | sales_purchase_summary
          - format: json | csv | pdf
        """
        rtype = request.query_params.get('type', 'stock')
        fmt   = request.query_params.get('format', 'json')

        # Call the corresponding action
        action_map = {
            'stock': self.stock,
            'low_stock': self.low_stock,
            'sales_purchase_summary': self.sales_purchase_summary,
        }
        if rtype not in action_map:
            return Response({'detail': 'Invalid report type.'}, status=400)

        data_resp = action_map[rtype](request)
        data = data_resp.data

        # JSON
        if fmt == 'json':
            return Response(data)

        # CSV
        if fmt == 'csv':
            buf = BytesIO()
            writer = csv.writer(buf)
            # header
            if isinstance(data, list) and data:
                writer.writerow(data[0].keys())
                for row in data:
                    writer.writerow(row.values())
            elif isinstance(data, dict):
                writer.writerow(data.keys())
                writer.writerow(data.values())
            response = HttpResponse(buf.getvalue(), content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="{rtype}.csv"'
            return response

        # PDF (simple tabular)
        if fmt == 'pdf':
            buf = BytesIO()
            p = canvas.Canvas(buf)
            y = 800
            # draw each line
            if isinstance(data, list):
                for item in data:
                    line = " | ".join(f"{k}:{v}" for k, v in item.items())
                    p.drawString(30, y, line)
                    y -= 15
                    if y < 50:
                        p.showPage()
                        y = 800
            else:
                for k, v in data.items():
                    p.drawString(30, y, f"{k}: {v}")
                    y -= 15
            p.save()
            pdf = buf.getvalue()
            response = HttpResponse(pdf, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{rtype}.pdf"'
            return response

        return Response({'detail': 'Unsupported format.'}, status=400)
