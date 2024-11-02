# models.py
from django.db import models
from django.contrib.auth.models import User
from uuid import uuid4

class DataUpload(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    file = models.FileField(upload_to='uploads/')  # Use Django's FileField to store the file
    file_format = models.CharField(max_length=10)
    step = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)    
    status = models.CharField(max_length=20, default="pending")  # Example field
    upload_id = str(uuid4())
    
    def __str__(self):
        return f"{self.user.username} - {self.upload_id}"

