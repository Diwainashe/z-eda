# your_app/admin.py

from django.contrib import admin
from .models import (
    # DataUpload,
    ValidEntries,
    StratifiedData,
    UploadLog,
    MasterData,
)

from django.contrib.auth.admin import UserAdmin as DefaultUserAdmin
from django.contrib.auth.models import User
from .models import LogEntry
import csv
from django.http import HttpResponse
# Inline Admin for ValidEntries
class ValidEntriesInline(admin.TabularInline):
    model = ValidEntries
    extra = 0
    readonly_fields = ('data', 'created_at',)
    can_delete = False
    show_change_link = True

# Inline Admin for StratifiedData
class StratifiedDataInline(admin.TabularInline):
    model = StratifiedData
    extra = 0
    readonly_fields = (
        'age_groups',
        'gender',
        'topography',
        'histology',
        'behavior',
        'grade',
        'basis_of_diagnosis',
        'created_at',
    )
    can_delete = False
    show_change_link = True

# Inline Admin for UploadLog
class UploadLogInline(admin.TabularInline):
    model = UploadLog
    extra = 0
    readonly_fields = ('step', 'details', 'created_at')
    can_delete = False
    show_change_link = True

# @admin.register(DataUpload)
# class DataUploadAdmin(admin.ModelAdmin):
#     list_display = [
#         'upload_id',
#         'user',
#         'file',
#         'file_format',
#         'status',
#         'step',
#         'created_at',
#     ]
#     list_filter = ['status', 'file_format', 'step', 'created_at']
#     search_fields = ['user__username', 'upload_id', 'file_format', 'step']
#     readonly_fields = ['upload_id', 'created_at']
#     ordering = ['-created_at']
#     inlines = [ValidEntriesInline, StratifiedDataInline, UploadLogInline]

#     # Optional: Customize the display of the user field
#     def user_username(self, obj):
#         return obj.user.username if obj.user else 'Anonymous'
#     user_username.short_description = 'User'

@admin.register(ValidEntries)
class ValidEntriesAdmin(admin.ModelAdmin):
    list_display = ['id', 'upload', 'get_registration_number', 'created_at']
    list_filter = ['upload', 'created_at']
    search_fields = ['upload__upload_id', 'data__registration_number']
    readonly_fields = ['upload', 'data', 'created_at']
    ordering = ['-created_at']

    def get_registration_number(self, obj):
        return obj.data.get('registration_number', 'N/A')
    get_registration_number.short_description = 'Registration Number'

@admin.register(StratifiedData)
class StratifiedDataAdmin(admin.ModelAdmin):
    list_display = [
        'id', 
        'age_groups', 
        'gender', 
        'topography', 
        'histology', 
        'behavior', 
        'grade', 
        'basis_of_diagnosis', 
        'created_at'
    ]
    readonly_fields = [
        'age_groups', 
        'gender', 
        'topography', 
        'histology', 
        'behavior', 
        'grade', 
        'basis_of_diagnosis', 
        'created_at'
    ]
    can_delete = False
    ordering = ['-created_at']

@admin.register(UploadLog)
class UploadLogAdmin(admin.ModelAdmin):
    list_display = ['id', 'upload', 'step', 'created_at']
    list_filter = ['step', 'created_at']
    search_fields = ['upload__upload_id', 'step']
    readonly_fields = ['upload', 'step', 'details', 'created_at']
    ordering = ['-created_at']

@admin.register(MasterData)
class MasterDataAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'user',
        'upload_id',
        'registration_number',
        'sex',
        'birth_date',
        'date_of_incidence',
        'topography',
        'histology',
        'behavior',
        'grade_code',
        'basis_of_diagnosis',
        'created_at',
    ]
    list_filter = ['sex', 'created_at']
    search_fields = [
        'user__username',
        'registration_number',
        'upload_id',
    ]
    readonly_fields = ['upload_id', 'created_at']
    ordering = ['-created_at']
    
    def save_model(self, request, obj, form, change):
        if not change:
            # Ensure upload_id is unique if required
            pass  # Since upload_id is unique in the model, Django handles it
        super().save_model(request, obj, form, change)

    # Optional: Display user information
    def user_username(self, obj):
        return obj.user.username if obj.user else 'Anonymous'
    user_username.short_description = 'User'

# Extend default User admin for custom management
class UserAdmin(DefaultUserAdmin):
    actions = ['activate_users', 'deactivate_users', 'change_user_role']

    def activate_users(self, request, queryset):
        queryset.update(is_active=True)

    def deactivate_users(self, request, queryset):
        queryset.update(is_active=False)

    def change_user_role(self, request, queryset):
        queryset.update(is_staff=True)  # Example for setting as staff
        # Alternatively, provide a custom interface for setting roles

    activate_users.short_description = "Activate selected users"
    deactivate_users.short_description = "Deactivate selected users"
    change_user_role.short_description = "Grant selected users staff role"

admin.site.unregister(User)
admin.site.register(User, UserAdmin)

# Register LogEntry for review and report generation
@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'timestamp', 'details')
    list_filter = ('action', 'timestamp')
    search_fields = ('user__username', 'details')
    
@admin.action(description="Export selected logs as CSV")
def export_logs_as_csv(modeladmin, request, queryset):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="logs.csv"'
    writer = csv.writer(response)
    
    # Write headers
    writer.writerow(['User', 'Action', 'Timestamp', 'Details'])
    
    # Write data rows
    for log in queryset:
        writer.writerow([log.user.username if log.user else "System", log.action, log.timestamp, log.details])
    
    return response

class LogEntryAdmin(admin.ModelAdmin):
    actions = [export_logs_as_csv]