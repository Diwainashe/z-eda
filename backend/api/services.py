# api/services.py
from django.core.mail import send_mail
from django.conf import settings
from .models import Registry
from django.shortcuts import get_object_or_404

def send_admin_approval_request(user):
    send_mail(
        subject="New User Registration Approval Required",
        message=f"A new user ({user.username}) has registered. Approve at: http://localhost:8000/approve/{user.id}/",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[settings.ADMIN_EMAIL],
    )

def approve_user_registration(user_id):
    user = get_object_or_404(Registry, id=user_id)
    user.is_valid = True
    user.save()
    send_mail(
        subject="Your Account is Approved",
        message=f"Hello {user.username}, your account has been approved. You can now log in.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
    )
