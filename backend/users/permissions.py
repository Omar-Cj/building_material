# users/permissions.py

from rest_framework import permissions

class IsAdmin(permissions.BasePermission):
    """Permission to allow only admin users."""
    
    def has_permission(self, request, view):
        return request.user and request.user.role == 'admin'


class IsManager(permissions.BasePermission):
    """Permission to allow only manager users."""
    
    def has_permission(self, request, view):
        return request.user and request.user.role == 'manager'


class IsWarehouseStaff(permissions.BasePermission):
    """Permission to allow only warehouse staff users."""
    
    def has_permission(self, request, view):
        return request.user and request.user.role == 'warehouse_staff'


class IsCustomer(permissions.BasePermission):
    """Permission to allow only customers."""
    
    def has_permission(self, request, view):
        return request.user and request.user.role == 'customer'


class IsAdminOrManager(permissions.BasePermission):
    """Permission to allow admin or manager users."""
    
    def has_permission(self, request, view):
        return request.user and request.user.role in ['admin', 'manager']


class IsAdminOrManagerOrReadOnly(permissions.BasePermission):
    """
    Permission to allow:
    - GET requests for any authenticated user
    - Other methods only for admin or manager users
    """
    
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user and request.user.role in ['admin', 'manager']


class IsUserOrAdminOrManager(permissions.BasePermission):
    """
    Permission to allow:
    - User to access their own data
    - Admin/Manager to access any user data
    """
    
    def has_object_permission(self, request, view, obj):
        # Allow access if this is the user's own data
        if obj == request.user:
            return True
        
        # Or the user is an admin or manager
        return request.user.role in ['admin', 'manager']