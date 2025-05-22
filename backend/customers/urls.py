from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    CustomerViewSet,
    CustomerContactViewSet,
    CustomerShippingAddressViewSet,
    CustomerPaymentViewSet
)

router = DefaultRouter()
router.register('customers', CustomerViewSet)
router.register('contacts', CustomerContactViewSet)
router.register('shipping-addresses', CustomerShippingAddressViewSet)
router.register('payments', CustomerPaymentViewSet)

urlpatterns = [
    path('', include(router.urls)),
]