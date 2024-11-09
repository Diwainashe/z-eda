# api/signals.py

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from rest_framework.authtoken.models import Token
from .models import MasterData, StratifiedData

@receiver(post_save, sender=User)
def create_auth_token(sender, instance=None, created=False, **kwargs):
    if created:
        Token.objects.create(user=instance)

@receiver([post_save, post_delete], sender=MasterData)
def regenerate_stratified_data(sender, instance, **kwargs):
    StratifiedData.generate_from_master()