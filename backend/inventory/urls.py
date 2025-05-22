# inventory/urls.py

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    UnitOfMeasureViewSet,
    MaterialViewSet,
    StockAdjustmentViewSet,
    MaterialLocationViewSet
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'units', UnitOfMeasureViewSet)
router.register(r'materials', MaterialViewSet)
router.register(r'stock-adjustments', StockAdjustmentViewSet)
router.register(r'locations', MaterialLocationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]