from django.urls import path
from .views import *

urlpatterns = [
    #path('login/', login_view, name='login'),
    path('upload-data/', DataUploadView.as_view(), name='upload-data'),
    path('auto-correct-codes/', AutoCorrectCodesView.as_view(), name='auto_correct_codes'),
    path('run-all-validations/', RunAllValidationsAPIView.as_view(), name='run-all-validations'),
    path('auth/login/', CustomObtainAuthToken.as_view(), name='api_token_auth'),
    path('auth/check/', CheckAuthView.as_view(), name='auth_check'),
]

