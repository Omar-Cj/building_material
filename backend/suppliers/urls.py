# suppliers/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SupplierViewSet,
    SupplierContactViewSet,
    SupplierMaterialViewSet
)

router = DefaultRouter()
router.register('suppliers', SupplierViewSet)
router.register('contacts', SupplierContactViewSet)
router.register('materials', SupplierMaterialViewSet)

urlpatterns = [
    path('', include(router.urls)),
]