# expenses/views.py
from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.permissions import IsAuthenticated

from .models import Expense
from .serializers import ExpenseSerializer
from users.permissions import IsAdminOrManagerOrReadOnly
from users.models import UserActivity

class ExpenseViewSet(viewsets.ModelViewSet):
    """
    CRUD for operational expenses, with soft-delete.
    """
    queryset = Expense.objects.filter(is_deleted=False)
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['type', 'paid_by', 'date']
    search_fields = ['description', 'type']
    ordering_fields = ['date', 'amount']

    def perform_create(self, serializer):
        expense = serializer.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Expense Created",
            module="Expenses",
            description=f"Created expense #{expense.id} ({expense.type}: {expense.amount})",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_update(self, serializer):
        expense = serializer.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Expense Updated",
            module="Expenses",
            description=f"Updated expense #{expense.id} ({expense.type}: {expense.amount})",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()
        UserActivity.objects.create(
            user=self.request.user,
            action="Expense Deleted",
            module="Expenses",
            description=f"Deleted expense #{instance.id} ({instance.type}: {instance.amount})",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
