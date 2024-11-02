# api/authentication.py

from rest_framework.authentication import TokenAuthentication
from rest_framework import exceptions

class CookieTokenAuthentication(TokenAuthentication):
    
    keyword = 'Token'
    def authenticate(self, request):
        token = request.COOKIES.get('auth_token')

        if not token:
            return None
        
        
        print(f"Authenticating with token: {token}")  # Debugging statement

        return self.authenticate_credentials(token)
