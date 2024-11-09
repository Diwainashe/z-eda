from django.urls import path
from .views import *


urlpatterns = [
    #path('login/', login_view, name='login'),
    # path('upload-data/', DataUploadView.as_view(), name='upload-data'),
    path('auto-correct-codes/', AutoCorrectCodesView.as_view(), name='auto_correct_codes'),
    path('run-all-validations/', RunAllValidationsAPIView.as_view(), name='run-all-validations'),
    # path('auth/login/', CustomObtainAuthToken.as_view(), name='api_token_auth'),    
    path('auth/logout/', logout_view, name='logout'),
    path('auth/check/', CheckAuthView.as_view(), name='auth_check'),
    path('consolidate/', consolidate_data, name="consolidate_data"),    
    path("masterdata/", master_data_view, name="masterdata"),    
    path('register/', register_user, name='register_user'),
    path('approve/<int:user_id>/', approve_user, name='approve_user'),
    path('auth/forgot-password/', forgot_password, name='forgot_password'),
    path('approve-reset/<int:user_id>/', approve_password_reset, name='approve_password_reset'),
    path('database-schema/', database_schema_view, name='database_schema'),
    path("stratified-data/", stratify_data_view, name="stratified_data"),
    path('admin/manage-users/', admin_user_management, name='admin_user_management'),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
]

