"""
ASGI config for zeda project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

# zeda/asgi.py

import os
import django
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
import zeda.routing  # Import your project's routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'zeda.settings')
django.setup()

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": URLRouter(
        zeda.routing.websocket_urlpatterns
    ),
})
