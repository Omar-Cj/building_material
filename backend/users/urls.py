
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, UserActivityViewSet

router = DefaultRouter()
router.register(r'', UserViewSet)
router.register(r'activities', UserActivityViewSet)

urlpatterns = [
    path('', include(router.urls)),
]