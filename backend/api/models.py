# your_app/models.py

from django.db import models
from django.contrib.auth.models import User
from uuid import uuid4
import logging
from django.contrib.auth.models import AbstractUser


logger = logging.getLogger(__name__)

# class DataUpload(models.Model):
#     user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
#     file = models.FileField(upload_to='uploads/')  # Use Django's FileField to store the file
#     file_format = models.CharField(max_length=10)
#     step = models.CharField(max_length=100)
#     created_at = models.DateTimeField(auto_now_add=True)    
#     status = models.CharField(max_length=20, default="pending")  # Example field
#     upload_id = models.UUIDField(default=uuid4, editable=False, unique=True)  # Changed: unique=True
    
#     def __str__(self):
#         return f"{self.user.username if self.user else 'Anonymous'} - {self.upload_id}"

class ValidEntries(models.Model):
    upload = models.JSONField()
    data = models.JSONField()  # Store each valid entry as JSON
    created_at = models.DateTimeField(auto_now_add=True, null=False, blank=False)  # Added field
    
    def __str__(self):
        return f"ValidEntry for {self.upload.upload_id}"

class StratifiedData(models.Model):
    upload_id = models.UUIDField(unique=True, editable=False, blank=False, null=False, default=uuid4)
    age_groups = models.JSONField()
    gender = models.JSONField()
    topography = models.JSONField()
    histology = models.JSONField()
    behavior = models.JSONField()
    grade = models.JSONField()
    basis_of_diagnosis = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    
    def __str__(self):
        return f"StratifiedData for {self.upload_id}"
    
        

class UploadLog(models.Model):
    upload = models.JSONField()
    step = models.CharField(max_length=50)
    details = models.TextField()  # Log details for the step performed
    created_at = models.DateTimeField(auto_now_add=True,  null=False, blank=False)  # Added field  # Added field
    
    def __str__(self):
        return f"Log: {self.step} for {self.upload.upload_id}"
    
class MasterData(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    upload_id = models.UUIDField()
    registration_number = models.CharField(max_length=100, null=True, blank=True)
    sex = models.CharField(max_length=10, null=True, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    date_of_incidence = models.DateField(null=True, blank=True)
    topography = models.CharField(max_length=255, null=True, blank=True)
    histology = models.CharField(max_length=255, null=True, blank=True)
    behavior = models.CharField(max_length=50, null=True, blank=True)
    grade_code = models.CharField(max_length=50, null=True, blank=True)
    basis_of_diagnosis = models.CharField(max_length=255, null=True, blank=True)    
    created_at = models.DateTimeField(auto_now_add=True, null=False, blank=False)
    
    class Meta:
        unique_together = ('registration_number', 'date_of_incidence')
    
    def __str__(self):
        return f"MasterData {self.upload_id} by {self.user.username}"

class Registry(AbstractUser):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('admin', 'Admin'),
    ]
    
    username = models.CharField(max_length=150, unique=True)
    password = models.CharField(max_length=128)  # Store hashed passwords
    email = models.EmailField(unique=True)
    is_valid = models.BooleanField(default=False)  # Approval status
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='user')
    
    # Override groups and user_permissions to avoid conflicts
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='registry_user_groups',  # Unique related_name to avoid conflict
        blank=True,
        help_text="The groups this user belongs to."
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='registry_user_permissions',  # Unique related_name to avoid conflict
        blank=True,
        help_text="Specific permissions for this user."
    )
    
    def __str__(self):
        return f"{self.username} ({self.role})"
    
class LogEntry(models.Model):
    ACTION_CHOICES = [
        ('register', 'Registration'),
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('upload', 'Data Upload'),
        ('validation', 'Data Validation'),
        ('autocorrect', 'Auto-correction'),
        ('deactivation', 'Account Deactivation'),
        ('role_change', 'Role Change'),
        ('report_generation', 'Report Generation'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='api_log_entries')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.JSONField(blank=True, null=True)  # Additional data as needed

    def __str__(self):
        return f"{self.user.username if self.user else 'System'} - {self.action}"
