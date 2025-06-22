from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Sum, Count, Max
from django.utils import timezone
from django.db import transaction
from datetime import datetime, timedelta
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from django.http import HttpResponse
import io

from .models import Debt, DebtPayment, DebtReminder
from .serializers import (
    DebtSerializer, DebtPaymentSerializer, DebtReminderSerializer,
    DebtSummarySerializer, CustomerDebtSummarySerializer, CreateCreditSaleSerializer
)
from customers.models import Customer
from sales.models import Sale, SaleItem
from inventory.models import Material


class DebtViewSet(viewsets.ModelViewSet):
    """ViewSet for managing debts."""
    
    queryset = Debt.objects.filter(is_deleted=False)
    serializer_class = DebtSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'customer', 'due_date', 'created_at']
    search_fields = ['customer__name', 'customer__phone', 'notes', 'payment_terms']
    ordering_fields = ['created_at', 'due_date', 'total_amount', 'remaining_amount']
    ordering = ['-created_at']
    
    def perform_create(self, serializer):
        """Set created_by when creating a debt."""
        serializer.save(created_by=self.request.user)
    
    def perform_update(self, serializer):
        """Set updated_by when updating a debt."""
        serializer.save(updated_by=self.request.user)
    
    def perform_destroy(self, instance):
        """Soft delete debt and update customer balance."""
        # Update customer outstanding balance
        customer = instance.customer
        customer.outstanding_balance -= instance.remaining_amount
        customer.save()
        
        # Soft delete
        instance.is_deleted = True
        instance.save()
    
    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """Get all overdue debts."""
        overdue_debts = self.queryset.filter(
            due_date__lt=timezone.now().date(),
            status__in=[Debt.PENDING, Debt.PARTIALLY_PAID]
        )
        
        # Update status to overdue
        for debt in overdue_debts:
            debt.update_status()
        
        serializer = self.get_serializer(overdue_debts, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get debt summary statistics."""
        queryset = self.get_queryset()
        
        total_debts = queryset.count()
        total_amount = queryset.aggregate(Sum('total_amount'))['total_amount__sum'] or 0
        paid_amount = queryset.aggregate(Sum('paid_amount'))['paid_amount__sum'] or 0
        remaining_amount = total_amount - paid_amount
        
        overdue_debts = queryset.filter(status=Debt.OVERDUE)
        overdue_count = overdue_debts.count()
        overdue_amount = sum(debt.remaining_amount for debt in overdue_debts)
        
        return Response({
            'total_debts': total_debts,
            'total_amount': total_amount,
            'paid_amount': paid_amount,
            'remaining_amount': remaining_amount,
            'overdue_count': overdue_count,
            'overdue_amount': overdue_amount,
            'collection_rate': (paid_amount / total_amount * 100) if total_amount > 0 else 0
        })
    
    @action(detail=False, methods=['get'])
    def customer_summary(self, request):
        """Get debt summary by customer."""
        customers_with_debts = Customer.objects.filter(
            debts__is_deleted=False
        ).distinct()
        
        serializer = CustomerDebtSummarySerializer(customers_with_debts, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark a debt as fully paid."""
        debt = self.get_object()
        
        if debt.status == Debt.PAID:
            return Response(
                {'error': 'Debt is already paid'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        remaining = debt.remaining_amount
        if remaining > 0:
            # Create a payment record for the remaining amount
            DebtPayment.objects.create(
                debt=debt,
                customer=debt.customer,
                amount=remaining,
                payment_method=request.data.get('payment_method', 'cash'),
                received_by=request.user,
                notes=f"Marked as paid by {request.user.username}"
            )
        
        return Response({'message': 'Debt marked as paid'})
    
    @action(detail=True, methods=['get'])
    def materials(self, request, pk=None):
        """Get detailed materials breakdown for a specific debt."""
        debt = self.get_object()
        
        if not debt.sale:
            return Response({
                'error': 'This debt is not associated with a sale',
                'materials': []
            }, status=status.HTTP_400_BAD_REQUEST)
        
        materials_data = debt.get_material_breakdown()
        
        # Add additional sale information
        sale_info = {
            'sale_id': debt.sale.id,
            'sale_date': debt.sale.sale_date,
            'materials_count': len(materials_data),
            'materials': materials_data
        }
        
        return Response(sale_info)
    
    @action(detail=False, methods=['get'])
    def export_report(self, request):
        """Export comprehensive debt report as PDF with materials information."""
        try:
            # Check authentication
            if not request.user.is_authenticated:
                return Response(
                    {'error': 'Authentication required for export'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            # Create PDF response
            response = HttpResponse(content_type='application/pdf')
            filename = f"debt_report_{timezone.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            # Create PDF
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.75*inch)
            styles = getSampleStyleSheet()
            elements = []
            
            # Company Header
            header_style = ParagraphStyle(
                'CustomHeader',
                parent=styles['Heading1'],
                fontSize=18,
                textColor=colors.darkblue,
                spaceAfter=20,
                alignment=1  # Center alignment
            )
            title = Paragraph("NurBuild Management System", header_style)
            subtitle = Paragraph("Comprehensive Debt Report", styles['Heading2'])
            elements.extend([title, subtitle, Spacer(1, 12)])
            
            # Date and Generated By
            date_str = timezone.now().strftime("%B %d, %Y at %I:%M %p")
            user_info = f"Generated by: {request.user.username} on {date_str}"
            date_para = Paragraph(user_info, styles['Normal'])
            elements.append(date_para)
            elements.append(Spacer(1, 20))
            
            # Summary Section
            try:
                summary_data = self.summary(request).data
                summary_title = Paragraph("Executive Summary", styles['Heading2'])
                elements.append(summary_title)
                elements.append(Spacer(1, 12))
                
                summary_table_data = [
                    ['Metric', 'Value'],
                    ['Total Debts', str(summary_data.get('total_debts', 0))],
                    ['Total Amount', f"${summary_data.get('total_amount', 0):,.2f}"],
                    ['Paid Amount', f"${summary_data.get('paid_amount', 0):,.2f}"],
                    ['Outstanding Amount', f"${summary_data.get('remaining_amount', 0):,.2f}"],
                    ['Overdue Debts', str(summary_data.get('overdue_count', 0))],
                    ['Overdue Amount', f"${summary_data.get('overdue_amount', 0):,.2f}"],
                    ['Collection Rate', f"{summary_data.get('collection_rate', 0):.1f}%"],
                ]
                
                summary_table = Table(summary_table_data, colWidths=[3*inch, 2*inch])
                summary_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 12),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('FONTSIZE', (0, 1), (-1, -1), 10)
                ]))
                
                elements.append(summary_table)
                elements.append(Spacer(1, 24))
            except Exception as e:
                # If summary fails, continue without it
                error_para = Paragraph(f"Summary data unavailable: {str(e)}", styles['Normal'])
                elements.append(error_para)
                elements.append(Spacer(1, 12))
            
            # Materials Analysis Section
            try:
                materials_data = self.materials_analysis(request).data
                if materials_data.get('materials_analysis'):
                    materials_title = Paragraph("Top Materials in Debt", styles['Heading2'])
                    elements.append(materials_title)
                    elements.append(Spacer(1, 12))
                    
                    materials_table_data = [['Material', 'SKU', 'Outstanding Value', 'Customers']]
                    for material in materials_data['materials_analysis'][:10]:  # Top 10 materials
                        materials_table_data.append([
                            material.get('material_name', 'N/A')[:25],
                            material.get('material_sku', 'N/A')[:15],
                            f"${material.get('outstanding_value', 0):,.2f}",
                            str(material.get('customers_count', 0))
                        ])
                    
                    materials_table = Table(materials_table_data, colWidths=[2.5*inch, 1.5*inch, 1.5*inch, 1*inch])
                    materials_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.darkgreen),
                        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 10),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                        ('BACKGROUND', (0, 1), (-1, -1), colors.lightgreen),
                        ('GRID', (0, 0), (-1, -1), 1, colors.black),
                        ('FONTSIZE', (0, 1), (-1, -1), 8)
                    ]))
                    
                    elements.append(materials_table)
                    elements.append(Spacer(1, 24))
            except Exception as e:
                # If materials analysis fails, continue without it
                pass
            
            # Detailed Debt List
            debts = self.get_queryset().select_related('customer').prefetch_related('sale__items__material')[:50]
            if debts:
                debt_title = Paragraph("Detailed Debt Records (Top 50)", styles['Heading2'])
                elements.append(debt_title)
                elements.append(Spacer(1, 12))
                
                debt_data = [['Customer', 'Amount', 'Paid', 'Outstanding', 'Due Date', 'Status', 'Materials']]
                for debt in debts:
                    # Get materials summary for this debt
                    materials_summary = debt.materials_summary if hasattr(debt, 'materials_summary') else 'N/A'
                    if len(materials_summary) > 30:
                        materials_summary = materials_summary[:27] + '...'
                    
                    debt_data.append([
                        debt.customer.name[:15],
                        f"${debt.total_amount:,.0f}",
                        f"${debt.paid_amount:,.0f}",
                        f"${debt.remaining_amount:,.0f}",
                        debt.due_date.strftime("%m/%d/%y"),
                        debt.get_status_display()[:8],
                        materials_summary
                    ])
                
                debt_table = Table(debt_data, colWidths=[1.2*inch, 0.8*inch, 0.8*inch, 0.8*inch, 0.8*inch, 0.8*inch, 1.8*inch])
                debt_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.darkorange),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.lightyellow),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('FONTSIZE', (0, 1), (-1, -1), 7),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')
                ]))
                
                elements.append(debt_table)
            
            # Footer
            elements.append(Spacer(1, 30))
            footer_text = f"Report generated on {timezone.now().strftime('%Y-%m-%d %H:%M:%S')} | NurBuild Management System"
            footer = Paragraph(footer_text, styles['Normal'])
            elements.append(footer)
            
            # Build PDF
            doc.build(elements)
            pdf = buffer.getvalue()
            buffer.close()
            response.write(pdf)
            
            return response
            
        except Exception as e:
            # Return error response instead of crashing
            return Response(
                {'error': f'Export failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'])
    def export_individual(self, request, pk=None):
        """Export individual debt report with full details."""
        try:
            # Check authentication
            if not request.user.is_authenticated:
                return Response(
                    {'error': 'Authentication required for export'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            debt = self.get_object()
            
            # Create PDF response
            response = HttpResponse(content_type='application/pdf')
            filename = f"debt_{debt.id}_statement_{timezone.now().strftime('%Y%m%d')}.pdf"
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            # Create PDF
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.75*inch)
            styles = getSampleStyleSheet()
            elements = []
            
            # Company Header
            header_style = ParagraphStyle(
                'CustomHeader',
                parent=styles['Heading1'],
                fontSize=20,
                textColor=colors.darkblue,
                spaceAfter=20,
                alignment=1
            )
            title = Paragraph("NurBuild Management System", header_style)
            subtitle = Paragraph(f"Debt Statement #{debt.id}", styles['Heading2'])
            elements.extend([title, subtitle, Spacer(1, 20)])
            
            # Customer Information
            customer_info = f"""
            <b>Customer Information:</b><br/>
            Name: {debt.customer.name}<br/>
            Phone: {debt.customer.phone}<br/>
            Email: {debt.customer.email or 'N/A'}<br/>
            Credit Limit: ${debt.customer.credit_limit or 0:,.2f}
            """
            customer_para = Paragraph(customer_info, styles['Normal'])
            elements.append(customer_para)
            elements.append(Spacer(1, 20))
            
            # Debt Summary
            debt_info = f"""
            <b>Debt Summary:</b><br/>
            Debt ID: #{debt.id}<br/>
            Created Date: {debt.created_at.strftime('%B %d, %Y')}<br/>
            Due Date: {debt.due_date.strftime('%B %d, %Y')}<br/>
            Status: {debt.get_status_display()}<br/>
            Priority: {debt.get_priority_display()}<br/>
            Total Amount: ${debt.total_amount:,.2f}<br/>
            Paid Amount: ${debt.paid_amount:,.2f}<br/>
            <b>Outstanding Balance: ${debt.remaining_amount:,.2f}</b>
            """
            debt_para = Paragraph(debt_info, styles['Normal'])
            elements.append(debt_para)
            elements.append(Spacer(1, 20))
            
            # Materials Breakdown
            if debt.sale and debt.sale.items.exists():
                materials_title = Paragraph("Materials Breakdown", styles['Heading2'])
                elements.append(materials_title)
                elements.append(Spacer(1, 12))
                
                materials_data = [['Material', 'SKU', 'Quantity', 'Unit Price', 'Total Value']]
                for item in debt.sale.items.select_related('material'):
                    materials_data.append([
                        item.material.name,
                        item.material.sku,
                        f"{item.quantity} {item.material.unit.abbreviation}",
                        f"${item.price:,.2f}",
                        f"${(item.quantity * item.price):,.2f}"
                    ])
                
                materials_table = Table(materials_data, colWidths=[2.5*inch, 1.5*inch, 1*inch, 1*inch, 1*inch])
                materials_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.darkgreen),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.lightgreen),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('FONTSIZE', (0, 1), (-1, -1), 9)
                ]))
                
                elements.append(materials_table)
                elements.append(Spacer(1, 20))
            
            # Payment History
            payments = debt.payments.filter(is_deleted=False, status='completed').order_by('-payment_date')
            if payments.exists():
                payment_title = Paragraph("Payment History", styles['Heading2'])
                elements.append(payment_title)
                elements.append(Spacer(1, 12))
                
                payment_data = [['Date', 'Amount', 'Method', 'Reference', 'Received By']]
                for payment in payments:
                    payment_data.append([
                        payment.payment_date.strftime('%m/%d/%Y'),
                        f"${payment.amount:,.2f}",
                        payment.get_payment_method_display(),
                        payment.reference_number or 'N/A',
                        payment.received_by.username if payment.received_by else 'N/A'
                    ])
                
                payment_table = Table(payment_data, colWidths=[1.2*inch, 1*inch, 1.2*inch, 1.5*inch, 1.1*inch])
                payment_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.lightblue),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('FONTSIZE', (0, 1), (-1, -1), 8)
                ]))
                
                elements.append(payment_table)
                elements.append(Spacer(1, 20))
            
            # Footer
            footer_text = f"Statement generated on {timezone.now().strftime('%Y-%m-%d %H:%M:%S')} | NurBuild Management System"
            footer = Paragraph(footer_text, styles['Normal'])
            elements.append(footer)
            
            # Build PDF
            doc.build(elements)
            pdf = buffer.getvalue()
            buffer.close()
            response.write(pdf)
            
            return response
            
        except Exception as e:
            return Response(
                {'error': f'Export failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def export_customer(self, request):
        """Export all debts for a specific customer as JSON data for printing."""
        try:
            # Check authentication
            if not request.user.is_authenticated:
                return Response(
                    {'error': 'Authentication required for export'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            
            customer_id = request.query_params.get('customer_id')
            if not customer_id:
                return Response(
                    {'error': 'customer_id parameter is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get customer and their debts
            from customers.models import Customer
            try:
                customer = Customer.objects.get(id=customer_id)
            except Customer.DoesNotExist:
                return Response(
                    {'error': 'Customer not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            debts = self.get_queryset().filter(customer=customer).select_related('sale').prefetch_related('sale__items__material', 'payments')
            
            # Prepare customer information
            customer_info = {
                'id': customer.id,
                'name': customer.name,
                'phone': customer.phone,
                'email': customer.email or 'N/A',
                'customer_type': customer.get_customer_type_display(),
                'credit_limit': float(customer.credit_limit or 0),
                'outstanding_balance': float(customer.outstanding_balance or 0)
            }
            
            # Prepare debt summary
            debt_summary = {
                'total_debts': debts.count(),
                'total_amount': 0,
                'total_paid': 0,
                'total_outstanding': 0
            }
            
            # Prepare detailed debt records
            debt_records = []
            materials_dict = {}
            
            for debt in debts:
                debt_summary['total_amount'] += float(debt.total_amount)
                debt_summary['total_paid'] += float(debt.paid_amount)
                debt_summary['total_outstanding'] += float(debt.remaining_amount)
                
                # Prepare payment history for this debt
                payments = []
                for payment in debt.payments.all():
                    payments.append({
                        'id': payment.id,
                        'amount': float(payment.amount),
                        'payment_method': payment.payment_method,
                        'date': payment.created_at.strftime('%Y-%m-%d'),
                        'notes': payment.notes or ''
                    })
                
                # Add debt record
                debt_records.append({
                    'id': debt.id,
                    'created_date': debt.created_at.strftime('%Y-%m-%d'),
                    'due_date': debt.due_date.strftime('%Y-%m-%d'),
                    'total_amount': float(debt.total_amount),
                    'paid_amount': float(debt.paid_amount),
                    'remaining_amount': float(debt.remaining_amount),
                    'status': debt.get_status_display(),
                    'notes': debt.notes or '',
                    'payments': payments
                })
                
                # Process materials for this debt
                if debt.sale and debt.sale.items.exists():
                    for item in debt.sale.items.all():
                        material_name = item.material.name
                        if material_name not in materials_dict:
                            materials_dict[material_name] = {
                                'sku': item.material.sku,
                                'quantity': 0,
                                'total_value': 0
                            }
                        materials_dict[material_name]['quantity'] += float(item.quantity)
                        materials_dict[material_name]['total_value'] += float(item.quantity * item.price)
            
            # Convert materials dict to list
            materials_summary = []
            for material_name, data in materials_dict.items():
                materials_summary.append({
                    'name': material_name,
                    'sku': data['sku'],
                    'quantity': data['quantity'],
                    'total_value': data['total_value']
                })
            
            # Prepare response data
            export_data = {
                'report_type': 'customer_debt_report',
                'generated_date': timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
                'customer': customer_info,
                'summary': debt_summary,
                'debts': debt_records,
                'materials': materials_summary
            }
            
            return Response(export_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {'error': f'Export failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'])
    def materials_analysis(self, request):
        """Get material-wise debt analysis."""
        debts = self.get_queryset().filter(sale__isnull=False)
        
        materials_analysis = {}
        
        for debt in debts.select_related('sale').prefetch_related('sale__items__material'):
            if not debt.sale or not debt.sale.items.exists():
                continue
                
            for item in debt.sale.items.all():
                material_id = item.material.id
                material_name = item.material.name
                material_sku = item.material.sku
                
                if material_id not in materials_analysis:
                    materials_analysis[material_id] = {
                        'material_id': material_id,
                        'material_name': material_name,
                        'material_sku': material_sku,
                        'total_debts': 0,
                        'total_quantity': 0,
                        'total_value': 0,
                        'outstanding_value': 0,
                        'customers_count': set(),
                        'overdue_value': 0,
                        'avg_debt_per_unit': 0
                    }
                
                # Calculate proportional values based on debt status
                item_total_value = float(item.quantity * item.price)
                debt_ratio = float(debt.remaining_amount) / float(debt.total_amount) if debt.total_amount > 0 else 0
                outstanding_item_value = item_total_value * debt_ratio
                
                materials_analysis[material_id]['total_debts'] += 1
                materials_analysis[material_id]['total_quantity'] += float(item.quantity)
                materials_analysis[material_id]['total_value'] += item_total_value
                materials_analysis[material_id]['outstanding_value'] += outstanding_item_value
                materials_analysis[material_id]['customers_count'].add(debt.customer.id)
                
                if debt.is_overdue:
                    materials_analysis[material_id]['overdue_value'] += outstanding_item_value
        
        # Convert sets to counts and calculate averages
        result = []
        for material_data in materials_analysis.values():
            material_data['customers_count'] = len(material_data['customers_count'])
            if material_data['total_quantity'] > 0:
                material_data['avg_debt_per_unit'] = material_data['outstanding_value'] / material_data['total_quantity']
            
            result.append(material_data)
        
        # Sort by outstanding value (highest first)
        result.sort(key=lambda x: x['outstanding_value'], reverse=True)
        
        return Response({
            'materials_analysis': result,
            'summary': {
                'total_materials': len(result),
                'total_outstanding_value': sum(m['outstanding_value'] for m in result),
                'total_overdue_value': sum(m['overdue_value'] for m in result),
                'most_valuable_material': result[0] if result else None
            }
        })


class DebtPaymentViewSet(viewsets.ModelViewSet):
    """ViewSet for managing debt payments."""
    
    queryset = DebtPayment.objects.filter(is_deleted=False)
    serializer_class = DebtPaymentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['debt', 'customer', 'payment_method', 'status', 'payment_date']
    search_fields = ['customer__name', 'reference_number', 'receipt_number', 'notes']
    ordering_fields = ['payment_date', 'amount']
    ordering = ['-payment_date']
    
    def perform_create(self, serializer):
        """Set received_by when creating a payment."""
        serializer.save(received_by=self.request.user)
    
    def perform_update(self, serializer):
        """Set updated_by when updating a payment."""
        serializer.save(updated_by=self.request.user)
    
    def perform_destroy(self, instance):
        """Soft delete payment."""
        instance.is_deleted = True
        instance.save()
    
    @action(detail=False, methods=['get'])
    def by_customer(self, request):
        """Get payments by customer."""
        customer_id = request.query_params.get('customer_id')
        if not customer_id:
            return Response(
                {'error': 'customer_id parameter required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        payments = self.queryset.filter(customer_id=customer_id)
        serializer = self.get_serializer(payments, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def daily_summary(self, request):
        """Get daily payment summary."""
        date_str = request.query_params.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Invalid date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            target_date = timezone.now().date()
        
        payments = self.queryset.filter(
            payment_date__date=target_date,
            status=DebtPayment.COMPLETED
        )
        
        summary = payments.aggregate(
            total_payments=Count('id'),
            total_amount=Sum('amount')
        )
        
        payment_methods = {}
        for payment in payments:
            method = payment.payment_method
            if method not in payment_methods:
                payment_methods[method] = {'count': 0, 'amount': 0}
            payment_methods[method]['count'] += 1
            payment_methods[method]['amount'] += float(payment.amount)
        
        return Response({
            'date': target_date,
            'total_payments': summary['total_payments'] or 0,
            'total_amount': summary['total_amount'] or 0,
            'payment_methods': payment_methods
        })


class DebtReminderViewSet(viewsets.ModelViewSet):
    """ViewSet for managing debt reminders."""
    
    queryset = DebtReminder.objects.all()
    serializer_class = DebtReminderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['debt', 'customer', 'reminder_type', 'status', 'scheduled_date']
    search_fields = ['customer__name', 'message', 'notes']
    ordering_fields = ['scheduled_date', 'sent_date']
    ordering = ['-scheduled_date']
    
    def perform_create(self, serializer):
        """Set created_by when creating a reminder."""
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending reminders that need to be sent."""
        pending_reminders = self.queryset.filter(
            status=DebtReminder.SCHEDULED,
            scheduled_date__lte=timezone.now()
        )
        
        serializer = self.get_serializer(pending_reminders, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_sent(self, request, pk=None):
        """Mark a reminder as sent."""
        reminder = self.get_object()
        
        reminder.status = DebtReminder.SENT
        reminder.sent_date = timezone.now()
        reminder.save()
        
        return Response({'message': 'Reminder marked as sent'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_credit_sale(request):
    """Create a credit sale (sale + debt in one transaction)."""
    serializer = CreateCreditSaleSerializer(data=request.data)
    
    if serializer.is_valid():
        data = serializer.validated_data
        
        try:
            with transaction.atomic():
                # Create the sale
                sale = Sale.objects.create(
                    customer=data['customer'],
                    tax=data.get('tax', 0),
                    discount=data.get('discount', 0),
                    total_amount=data['calculated_total'],
                    payment_method='credit',  # New payment method for credit sales
                    created_by=request.user
                )
                
                # Create sale items
                for item_data in data['items']:
                    material = Material.objects.get(id=item_data['material_id'])
                    SaleItem.objects.create(
                        sale=sale,
                        material=material,
                        quantity=item_data['quantity'],
                        price=item_data['price']
                    )
                    
                    # Update inventory
                    material.quantity_in_stock -= float(item_data['quantity'])
                    material.save()
                
                # Create the debt
                debt = Debt.objects.create(
                    customer=data['customer'],
                    sale=sale,
                    total_amount=data['calculated_total'],
                    due_date=data['due_date'],
                    interest_rate=data.get('interest_rate', 0),
                    payment_terms=data.get('payment_terms', ''),
                    notes=data.get('notes', ''),
                    created_by=request.user
                )
                
                return Response({
                    'message': 'Credit sale created successfully',
                    'sale_id': sale.id,
                    'debt_id': debt.id
                }, status=status.HTTP_201_CREATED)
                
        except Exception as e:
            return Response(
                {'error': f'Failed to create credit sale: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validate_customer_credit(request):
    """Validate if a customer can take credit for a specific amount."""
    customer_id = request.data.get('customer_id')
    credit_amount = request.data.get('credit_amount')
    
    if not customer_id or not credit_amount:
        return Response(
            {'error': 'customer_id and credit_amount are required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        customer = Customer.objects.get(id=customer_id)
        credit_amount = float(credit_amount)
    except Customer.DoesNotExist:
        return Response(
            {'error': 'Customer not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except (ValueError, TypeError):
        return Response(
            {'error': 'Invalid credit amount'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Calculate available credit - convert to Decimal for consistent calculations
    from decimal import Decimal
    
    credit_limit = Decimal(str(customer.credit_limit or 0))
    outstanding_balance = Decimal(str(customer.outstanding_balance or 0))
    credit_amount_decimal = Decimal(str(credit_amount))
    available_credit = credit_limit - outstanding_balance
    
    # Check if credit is available
    can_take_credit = credit_amount_decimal <= available_credit
    
    # Calculate approval threshold (80% of available credit)
    approval_threshold = available_credit * Decimal('0.8')
    
    # Prepare response
    response_data = {
        'customer_id': customer.id,
        'customer_name': customer.name,
        'credit_limit': float(credit_limit),
        'outstanding_balance': float(outstanding_balance),
        'available_credit': float(available_credit),
        'requested_amount': float(credit_amount_decimal),
        'can_take_credit': can_take_credit,
        'approval_required': credit_amount_decimal > approval_threshold,
    }
    
    if not can_take_credit:
        response_data['reason'] = f"Requested amount ${float(credit_amount_decimal):,.2f} exceeds available credit ${float(available_credit):,.2f}"
        response_data['shortfall'] = float(credit_amount_decimal - available_credit)
    
    return Response(response_data)
