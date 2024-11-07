# your_app/admin.py

from django.contrib import admin
from .models import (
    # DataUpload,
    ValidEntries,
    StratifiedData,
    UploadLog,
    MasterData,
)

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
    list_display = ['id', 'upload', 'age_groups', 'gender', 'topography', 'histology', 'behavior', 'grade', 'basis_of_diagnosis', 'created_at']
    list_filter = ['upload', 'age_groups', 'gender', 'created_at']
    search_fields = ['upload__upload_id']
    readonly_fields = [
        'upload',
        'age_groups',
        'gender',
        'topography',
        'histology',
        'behavior',
        'grade',
        'basis_of_diagnosis',
        'created_at',
    ]
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
