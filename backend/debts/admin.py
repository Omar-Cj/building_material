from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import Debt, DebtPayment, DebtReminder


@admin.register(Debt)
class DebtAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'customer', 'total_amount', 'paid_amount', 'remaining_amount_display',
        'status_display', 'priority_display', 'due_date', 'days_overdue_display', 'created_at'
    ]
    list_filter = [
        'status', 'priority', 'due_date', 'created_at', 
        'customer__customer_type', 'interest_rate'
    ]
    search_fields = [
        'customer__name', 'customer__phone', 'customer__email',
        'notes', 'payment_terms'
    ]
    readonly_fields = [
        'created_at', 'updated_at', 'remaining_amount_display',
        'is_overdue', 'days_overdue_display', 'payment_percentage_display'
    ]
    fieldsets = (
        ('Basic Information', {
            'fields': ('customer', 'sale', 'total_amount', 'paid_amount')
        }),
        ('Payment Details', {
            'fields': ('due_date', 'interest_rate', 'payment_terms')
        }),
        ('Status & Priority', {
            'fields': ('status', 'priority', 'last_payment_date')
        }),
        ('Calculated Fields', {
            'fields': ('remaining_amount_display', 'is_overdue', 
                      'days_overdue_display', 'payment_percentage_display'),
            'classes': ('collapse',)
        }),
        ('Notes & Audit', {
            'fields': ('notes', 'created_by', 'updated_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    
    def remaining_amount_display(self, obj):
        amount = obj.remaining_amount
        if amount > 0:
            return format_html(
                '<span style="color: #e74c3c; font-weight: bold;">${:.2f}</span>',
                amount
            )
        return format_html('<span style="color: #27ae60;">$0.00</span>')
    remaining_amount_display.short_description = 'Remaining Amount'
    
    def status_display(self, obj):
        colors = {
            'pending': '#f39c12',
            'overdue': '#e74c3c',
            'partially_paid': '#3498db',
            'paid': '#27ae60',
            'cancelled': '#95a5a6'
        }
        color = colors.get(obj.status, '#95a5a6')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_display.short_description = 'Status'
    
    def priority_display(self, obj):
        colors = {
            'low': '#95a5a6',
            'medium': '#3498db',
            'high': '#f39c12',
            'critical': '#e74c3c'
        }
        color = colors.get(obj.priority, '#95a5a6')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_priority_display()
        )
    priority_display.short_description = 'Priority'
    
    def days_overdue_display(self, obj):
        days = obj.days_overdue
        if days > 0:
            return format_html(
                '<span style="color: #e74c3c; font-weight: bold;">{} days</span>',
                days
            )
        return '-'
    days_overdue_display.short_description = 'Days Overdue'
    
    def payment_percentage_display(self, obj):
        percentage = obj.payment_percentage
        if percentage >= 100:
            color = '#27ae60'
        elif percentage >= 50:
            color = '#f39c12'
        else:
            color = '#e74c3c'
        return format_html(
            '<span style="color: {}; font-weight: bold;">{:.1f}%</span>',
            color, percentage
        )
    payment_percentage_display.short_description = 'Payment %'


@admin.register(DebtPayment)
class DebtPaymentAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'debt_link', 'customer', 'amount', 'payment_method',
        'payment_date', 'status_display', 'received_by'
    ]
    list_filter = [
        'payment_method', 'status', 'payment_date',
        'customer__customer_type', 'received_by'
    ]
    search_fields = [
        'customer__name', 'debt__id', 'reference_number',
        'receipt_number', 'notes'
    ]
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Payment Information', {
            'fields': ('debt', 'customer', 'amount', 'payment_method', 'payment_date')
        }),
        ('Reference & Receipt', {
            'fields': ('reference_number', 'receipt_number', 'status')
        }),
        ('Notes & Audit', {
            'fields': ('notes', 'received_by', 'updated_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    date_hierarchy = 'payment_date'
    ordering = ['-payment_date']
    
    def debt_link(self, obj):
        url = reverse('admin:debts_debt_change', args=[obj.debt.pk])
        return format_html('<a href="{}">{}</a>', url, f'Debt #{obj.debt.id}')
    debt_link.short_description = 'Debt'
    
    def status_display(self, obj):
        colors = {
            'pending': '#f39c12',
            'completed': '#27ae60',
            'failed': '#e74c3c',
            'refunded': '#9b59b6'
        }
        color = colors.get(obj.status, '#95a5a6')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_display.short_description = 'Status'


@admin.register(DebtReminder)
class DebtReminderAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'debt_link', 'customer', 'reminder_type',
        'scheduled_date', 'sent_date', 'status_display'
    ]
    list_filter = [
        'reminder_type', 'status', 'scheduled_date',
        'sent_date', 'customer__customer_type'
    ]
    search_fields = [
        'customer__name', 'debt__id', 'message', 'notes'
    ]
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Reminder Information', {
            'fields': ('debt', 'customer', 'reminder_type', 'scheduled_date')
        }),
        ('Content & Status', {
            'fields': ('message', 'status', 'sent_date')
        }),
        ('Notes & Audit', {
            'fields': ('notes', 'created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )
    date_hierarchy = 'scheduled_date'
    ordering = ['-scheduled_date']
    
    def debt_link(self, obj):
        url = reverse('admin:debts_debt_change', args=[obj.debt.pk])
        return format_html('<a href="{}">{}</a>', url, f'Debt #{obj.debt.id}')
    debt_link.short_description = 'Debt'
    
    def status_display(self, obj):
        colors = {
            'scheduled': '#3498db',
            'sent': '#27ae60',
            'failed': '#e74c3c',
            'cancelled': '#95a5a6'
        }
        color = colors.get(obj.status, '#95a5a6')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color, obj.get_status_display()
        )
    status_display.short_description = 'Status'
