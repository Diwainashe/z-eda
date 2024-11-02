# serializers.py
from rest_framework import serializers
from .models import DataUpload

class DataUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataUpload
        fields = ['id', 'user', 'file', 'file_format', 'step', 'status', 'error_message', 'created_at']
