# api/routing.py

from django.urls import path
from . import consumers

websocket_urlpatterns = [
    path("ws/validations/<str:validation_id>/", consumers.ValidationConsumer.as_asgi()),
]
