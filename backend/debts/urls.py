from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    DebtViewSet,
    DebtPaymentViewSet,
    DebtReminderViewSet,
    create_credit_sale,
    validate_customer_credit
)

router = DefaultRouter()
router.register('debts', DebtViewSet)
router.register('payments', DebtPaymentViewSet)
router.register('reminders', DebtReminderViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('create-credit-sale/', create_credit_sale, name='create-credit-sale'),
    path('validate-credit/', validate_customer_credit, name='validate-customer-credit'),
]