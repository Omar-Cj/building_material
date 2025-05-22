# expenses/serializers.py
from rest_framework import serializers
from .models import Expense

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = [
            'id', 'type', 'amount', 'description',
            'paid_by', 'date'
        ]
        read_only_fields = ['id']
