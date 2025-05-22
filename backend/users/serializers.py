# users/serializers.py

from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import UserActivity

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    """Serializer for the User model."""
    
    password = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'phone', 'role', 
                  'address', 'profile_picture', 'password', 'is_active', 
                  'date_joined', 'last_login']
        read_only_fields = ['id', 'date_joined', 'last_login']
        extra_kwargs = {
            'password': {'write_only': True}
        }
    
    def validate_password(self, value):
        """Validate password using Django's password validators."""
        validate_password(value)
        return value
    
    def create(self, validated_data):
        """Create a new user with encrypted password."""
        password = validated_data.pop('password', None)
        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user
    
    def update(self, instance, validated_data):
        """Update user data and password if provided."""
        password = validated_data.pop('password', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        if password:
            instance.set_password(password)
        
        instance.save()
        return instance


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for user profile data (excludes sensitive information)."""
    
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'phone', 'role', 
                  'address', 'profile_picture']
        read_only_fields = ['id', 'email', 'role']


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for password change endpoint."""
    
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)
    
    def validate_new_password(self, value):
        """Validate the new password using Django's password validators."""
        validate_password(value)
        return value


class UserActivitySerializer(serializers.ModelSerializer):
    """Serializer for user activity logs."""
    
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = UserActivity
        fields = ['id', 'user', 'user_email', 'action', 'action_time', 
                  'module', 'description', 'ip_address']
        read_only_fields = ['id', 'user', 'user_email', 'action_time']