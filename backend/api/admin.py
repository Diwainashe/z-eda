# admin.py
from django.contrib import admin
from .models import DataUpload

@admin.register(DataUpload)
class DataUploadAdmin(admin.ModelAdmin):
    list_display = ['upload_id','user', 'file', 'file_format', 'status', 'step', 'created_at']
