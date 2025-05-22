# users/views.py

from rest_framework import viewsets, status, generics, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _

from .models import UserActivity
from .serializers import (
    UserSerializer, 
    UserProfileSerializer, 
    PasswordChangeSerializer,
    UserActivitySerializer
)
from .permissions import (
    IsAdmin, 
    IsAdminOrManager, 
    IsUserOrAdminOrManager
)

User = get_user_model()

class UserViewSet(viewsets.ModelViewSet):
    """API endpoints for user management."""
    
    queryset = User.objects.all()
    serializer_class = UserSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['role', 'is_active']
    search_fields = ['email', 'first_name', 'last_name', 'phone']
    ordering_fields = ['date_joined', 'last_login', 'email', 'first_name', 'last_name']
    
    def get_permissions(self):
        """
        Define permissions based on action:
        - List/retrieve: Admin or Manager
        - Create/update/delete: Admin only
        - Profile/password: The user or an Admin/Manager
        """
        if self.action in ['list', 'retrieve']:
            permission_classes = [IsAuthenticated, IsAdminOrManager]
        elif self.action in ['create', 'destroy', 'update', 'partial_update']:
            permission_classes = [IsAuthenticated, IsAdmin]
        elif self.action in ['profile', 'change_password']:
            permission_classes = [IsAuthenticated, IsUserOrAdminOrManager]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_serializer_class(self):
        """Return appropriate serializer class based on action."""
        if self.action == 'profile':
            return UserProfileSerializer
        elif self.action == 'change_password':
            return PasswordChangeSerializer
        return UserSerializer
    
    def perform_create(self, serializer):
        """Create a new user."""
        user = serializer.save()
        # Log the activity
        UserActivity.objects.create(
            user=self.request.user,
            action="User Created",
            module="Users",
            description=f"Created user {user.email} with role {user.role}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
    
    def perform_update(self, serializer):
        """Update a user."""
        user = serializer.save()
        # Log the activity
        UserActivity.objects.create(
            user=self.request.user,
            action="User Updated",
            module="Users",
            description=f"Updated user {user.email}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
    
    def perform_destroy(self, instance):
        """Delete a user (soft delete by deactivating)."""
        # Instead of actual deletion, just deactivate the user
        instance.is_active = False
        instance.save()
        # Log the activity
        UserActivity.objects.create(
            user=self.request.user,
            action="User Deactivated",
            module="Users",
            description=f"Deactivated user {instance.email}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
    
    @action(detail=False, methods=['get', 'put', 'patch'])
    def profile(self, request):
        """
        Get or update the current user's profile.
        """
        user = request.user
        if request.method == 'GET':
            serializer = self.get_serializer(user)
            return Response(serializer.data)
        
        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """
        Change the current user's password.
        """
        user = request.user
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Check old password
        if not user.check_password(serializer.validated_data['old_password']):
            return Response(
                {'old_password': [_('Wrong password.')]},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Set new password
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        # Log the activity
        UserActivity.objects.create(
            user=user,
            action="Password Changed",
            module="Users",
            description=f"User {user.email} changed their password",
            ip_address=request.META.get('REMOTE_ADDR')
        )
        
        return Response({'status': 'password set'}, status=status.HTTP_200_OK)


class UserActivityViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoints for viewing user activities (read-only)."""
    
    queryset = UserActivity.objects.all()
    serializer_class = UserActivitySerializer
    permission_classes = [IsAuthenticated, IsAdminOrManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['user', 'module', 'action']
    search_fields = ['description', 'action']
    ordering_fields = ['action_time', 'user__email']
    
    def get_queryset(self):
        """
        Limit queryset based on user role:
        - Admin/Manager: All activities
        - Others: Only their own activities
        """
        queryset = super().get_queryset()
        if self.request.user.role not in ['admin', 'manager']:
            queryset = queryset.filter(user=self.request.user)
        return queryset