from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.authtoken.models import Token
from rest_framework import status
import logging
import json
from rest_framework.parsers import JSONParser
from django.db.models import Count
from django.contrib.auth import authenticate
from django.conf import settings
from .models import MasterData, StratifiedData, Registry
from .utils import auto_correct_codes # Import only the needed functions
from .tasks import run_all_validations_task 
import uuid
from django.contrib.auth import logout
from rest_framework.permissions import IsAdminUser
# views.py
from rest_framework.decorators import api_view, permission_classes, parser_classes
from django.db import IntegrityError, transaction
from django.contrib.auth.hashers import check_password
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.contrib.auth.models import User
from django.apps import apps
from .models import LogEntry
from django.utils.dateparse import parse_date
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import BasePermission

# Initialize logging for debugging
logging.basicConfig(level=logging.DEBUG)

# Initialize logger
logger = logging.getLogger(__name__)

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

# This view handles the login and returns access and refresh tokens.
class CustomTokenObtainPairView(TokenObtainPairView):
    pass

# This view handles refreshing the token when it expires.
class CustomTokenRefreshView(TokenRefreshView):
    pass

class IsSuperUser(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superuser

class LoginView(APIView):
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(request, username=username, password=password)

        if user is not None:
            if user.is_active:
                refresh = RefreshToken.for_user(user)
                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                })
            return Response({'error': 'Account is inactive.'}, status=status.HTTP_403_FORBIDDEN)
        return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)
    
class RegisterView(APIView):
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        email = request.data.get("email")

        if not username or not password or not email:
            return Response({'error': 'All fields are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        # Create the user with is_active=False initially
        user = User.objects.create_user(username=username, password=password, email=email, is_active=False)

        # Send email to admin for approval
        approval_link = f"http://localhost:8000/approve-user/{user.id}/"
        send_mail(
            subject="New User Registration Approval Required",
            message=f"A new user ({username}) has registered. Approve their account at: {approval_link}",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.ADMIN_EMAIL],
        )

        return Response({'message': 'Registration successful. Awaiting admin approval.'}, status=status.HTTP_201_CREATED)

# Step 4: Auto-Correction
# API View to handle the auto-correction process
class AutoCorrectCodesView(APIView):
    def post(self, request, *args, **kwargs):
        logger.info("Auto-correction process started for user: %s", request.user.username)

        try:
            dataset = request.data.get('dataset')
            if not dataset:
                logger.warning("Auto-correction request failed: No dataset provided by user %s", request.user.username)
                return Response({"error": "Dataset is required."}, status=status.HTTP_400_BAD_REQUEST)

            # Log the dataset received (consider anonymizing or truncating if large or sensitive)
            logger.debug("Dataset received: %s", str(dataset)[:500])  # Log only the first 500 characters for brevity

            # Run auto-correction on dataset
            corrected_data, corrections = auto_correct_codes(dataset)

            # Check if corrections failed due to missing JSON data
            if corrected_data is None:
                logger.error("Auto-correction failed: %s", corrections)
                return Response(
                    {"error": corrections},  # corrections here contains the error message
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Log the results of the correction
            logger.info("Auto-correction completed successfully for user %s", request.user.username)
            logger.debug("Corrections made: %s", corrections)

            return Response({
                "corrected_data": corrected_data,
                "corrections": corrections
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error("An unexpected error occurred during auto-correction: %s", str(e))
            return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RunAllValidationsAPIView(APIView):
    """
    API endpoint to initiate all validations and return results directly.
    """

    def post(self, request, format=None):
        logger.info("Validation request initiated by user: %s", request.user.username)

        # Extract dataset from the request body
        dataset = request.data.get('dataset', [])
        if not dataset:
            logger.warning("Validation request failed: No dataset provided by user %s", request.user.username)
            return Response({"error": "No dataset provided."}, status=status.HTTP_400_BAD_REQUEST)

        # Generate a unique ID for tracking
        validation_id = str(uuid.uuid4())
        logger.debug("Generated validation ID: %s", validation_id)

        # Run validations synchronously and get results
        try:
            result = run_all_validations_task(validation_id, dataset)
            logger.info("Validation completed for ID: %s", validation_id)
        except Exception as e:
            logger.error("Validation failed for ID %s with error: %s", validation_id, str(e))
            return Response({"error": "Validation process encountered an error."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Format the response to include validation results and valid entries
        return Response({
            "validation_id": validation_id,
            "validation_results": result['validation_results'],
            "valid_entries": result['valid_entries']
        }, status=status.HTTP_200_OK)


class LoginView(APIView):
    @csrf_exempt
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(request, username=username, password=password)

        if user is not None:
            if user.is_active:  # Check if user is approved
                refresh = RefreshToken.for_user(user)
                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                })
            return Response({'error': 'Account is not approved yet.'}, status=status.HTTP_403_FORBIDDEN)
        return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

class CustomObtainAuthToken(APIView):
    @csrf_exempt
    def post(self, request, *args, **kwargs):
        try:
            # Parse JSON data from the request body
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            logger.info(f"Authentication attempt for username: {username}")
        except json.JSONDecodeError:
            logger.warning("Invalid JSON data received in authentication request.")
            return JsonResponse({'error': 'Invalid JSON data.'}, status=400)

        # Authenticate the user
        user = authenticate(request, username=username, password=password)
        if user is not None:
            if user.is_active:
                # Generate or retrieve the token
                token, _ = Token.objects.get_or_create(user=user)
                logger.info(f"Token generated for user {username}.")
                return JsonResponse({'token': token.key}, status=200)
            else:
                logger.warning(f"User account {username} is not approved yet.")
                return JsonResponse({'error': 'Account not approved yet.'}, status=403)
        else:
            logger.warning(f"Invalid credentials provided for username: {username}")
            return JsonResponse({'error': 'Invalid credentials'}, status=400)
        # except Exception as e:
        #     logger.error(f"Unexpected error during authentication: {str(e)}")
            # return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
            



class CheckAuthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Return authentication status and additional user details
        return Response({
            'authenticated': True,
            'username': request.user.username,
            'is_staff': request.user.is_staff  # Check if the user has staff privileges
        })

    

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def consolidate_data(request):
    user = request.user
    logger.info(f"User {user.username} initiated data consolidation.")

    # Extract data from request
    upload_id = request.data.get('upload_id')
    valid_entries = request.data.get('valid_entries')

    if not upload_id or not valid_entries:
        logger.warning("Missing upload_id or valid_entries in the request.")
        return Response({'error': 'Missing upload_id or valid_entries'}, status=400)

    # Parse valid_entries if it's a JSON string
    if isinstance(valid_entries, str):
        try:
            valid_entries = json.loads(valid_entries)
            logger.debug(f"Parsed valid_entries from JSON string for upload_id {upload_id}.")
        except json.JSONDecodeError:
            logger.error("Invalid JSON format in valid_entries.")
            return Response({'error': 'Invalid valid_entries format'}, status=400)

    # Save each valid entry into MasterData
    try:
        master_data_instances = []
        logger.info(f"Preparing to save {len(valid_entries)} valid entries to MasterData for upload_id {upload_id}.")

        for entry in valid_entries:
            master_data_instances.append(
                MasterData(
                    user=user,
                    upload_id=uuid.UUID(upload_id),
                    registration_number=entry.get('registration_number'),
                    sex=entry.get('sex'),
                    birth_date=entry.get('birth_date'),
                    date_of_incidence=entry.get('date_of_incidence'),
                    topography=entry.get('topography'),
                    histology=entry.get('histology'),
                    behavior=entry.get('behavior'),
                    grade_code=entry.get('grade_code'),
                    basis_of_diagnosis=entry.get('basis_of_diagnosis'),
                )
            )

        with transaction.atomic():
            MasterData.objects.bulk_create(master_data_instances, ignore_conflicts=True)
            logger.info(f"Successfully saved {len(master_data_instances)} entries to MasterData for upload_id {upload_id}.")

    except IntegrityError as e:
        logger.error(f"Integrity error while saving to MasterData: {str(e)}")
        return Response({'error': f'Integrity error: {str(e)}'}, status=400)
    except Exception as e:
        logger.error(f"Unexpected error while saving data: {str(e)}")
        return Response({'error': f'Error saving data: {str(e)}'}, status=500)


    logger.info(f"Data consolidation process completed successfully for upload_id {upload_id}.")
    return Response({"message": "Data consolidated and saved successfully."}, status=201)


@csrf_exempt
def master_data_view(request):
    """
    Endpoint to retrieve raw data from MasterData without any filters or formatting.
    """
    try:
        # Retrieve all records from MasterData
        queryset = MasterData.objects.all()

        # Convert queryset to a list of dictionaries for JSON serialization
        data = list(queryset.values())

        # Log the total count of records and a sample record for debugging
        logger.info(f"Total records retrieved from MasterData: {len(data)}")
        if len(data) > 0:
            logger.debug(f"Sample record from MasterData: {data[0]}")

        # Return raw data as JSON
        return JsonResponse(data, safe=False)

    except Exception as e:
        logger.error(f"Failed to retrieve records from MasterData: {e}")
        return JsonResponse({'error': 'Failed to retrieve data.'}, status=500)

def approve_user(request, user_id):
    user = get_object_or_404(User, id=user_id)
    if request.method == 'GET':
        user.is_active = True
        user.save()

        # Optionally, notify the user their account is now active
        send_mail(
            subject="Your Account is Approved",
            message=f"Hello {user.username}, your account has been approved. You can now log in.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
        )

        return JsonResponse({'message': f"User {user.username} has been approved."}, status=200)

import json
import logging
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth.hashers import make_password
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User

logger = logging.getLogger(__name__)

@csrf_exempt
def forgot_password(request):
    if request.method == 'POST':
        try:
            # Parse JSON data from the request body
            data = json.loads(request.body)
            username = data.get('username')
            new_password = data.get('new_password')
            logger.info(f"Password reset requested for username: {username}")
        except json.JSONDecodeError:
            logger.error("Invalid JSON data received in password reset request.")
            return JsonResponse({'error': 'Invalid JSON data.'}, status=400)

        # Find user, update password, and deactivate temporarily
        try:
            user = User.objects.get(username=username)
            user.password = make_password(new_password)  # Set the new password
            user.is_active = False  # Deactivate user until admin approves
            user.save()
            logger.info(f"User '{username}' password updated and temporarily deactivated.")

            # Notify admin for approval
            send_mail(
                subject="Password Reset Approval Required",
                message=f"{user.username} requested a password reset. Approve at: http://localhost:8000/approve-reset/{user.id}/",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.ADMIN_EMAIL],
            )
            logger.info(f"Password reset request email sent to admin for user '{username}'.")

            return JsonResponse({'message': 'Password reset request sent to admin.'}, status=200)
        except User.DoesNotExist:
            logger.warning(f"Password reset requested for non-existent user: {username}")
            return JsonResponse({'error': 'User not found'}, status=404)

    # Handle non-POST requests by returning an error message
    return JsonResponse({'error': 'Only POST requests are allowed on this endpoint.'}, status=405)


@csrf_exempt
def approve_password_reset(request, user_id):
    try:
        # Retrieve user for password reset approval
        user = get_object_or_404(User, id=user_id)
        logger.info(f"Admin approving password reset for user '{user.username}' (ID: {user_id}).")

        # Re-activate user
        user.is_active = True  # Reactivate the user
        user.save()
        logger.info(f"User '{user.username}' re-activated.")

        # Notify user of successful reset and re-activation
        send_mail(
            subject="Password Reset Approved",
            message="Your password reset has been approved. You can now log in with your new password.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
        )
        logger.info(f"Password reset approval email sent to user '{user.username}'.")

        return JsonResponse({'message': 'Password reset approved.'})
    except Exception as e:
        logger.error(f"Failed to approve password reset for user ID {user_id}: {e}")
        return JsonResponse({'error': 'Failed to approve password reset.'}, status=500)


@csrf_exempt
def register_user(request):
    if request.method == 'POST':
        try:
            # Parse JSON data from the request body
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            email = data.get('email')
            
            # Log user input data (excluding password for security)
            logger.info(f"Attempting registration for username: {username}, email: {email}")
            
        except json.JSONDecodeError:
            logger.error("Invalid JSON data received.")
            return JsonResponse({'error': 'Invalid JSON data.'}, status=400)

        # Validate inputs
        if not username or not password or not email:
            logger.warning("Registration attempt with missing fields.")
            return JsonResponse({'error': 'All fields are required.'}, status=400)

        if User.objects.filter(username=username).exists():
            logger.warning(f"Username '{username}' already exists.")
            return JsonResponse({'error': 'Username already exists.'}, status=400)

        # Create the user with is_active=False initially
        try:
            user = User.objects.create(
                username=username,
                password=make_password(password),  # Ensure password is hashed
                email=email,
                is_active=False  # Set inactive until approved
            )
            logger.info(f"User '{username}' created successfully, pending approval.")
        except Exception as e:
            logger.error(f"Error creating user '{username}': {e}")
            return JsonResponse({'error': 'Failed to create user.'}, status=500)

        # Send email to admin for approval
        try:
            send_mail(
                subject="New User Registration Approval Required",
                message=f"A new user ({username}) has registered. Approve at: http://localhost:8000/approve/{user.id}/",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.ADMIN_EMAIL],
            )
            logger.info(f"Approval email sent to admin for user '{username}'.")
        except Exception as e:
            logger.error(f"Failed to send approval email for user '{username}': {e}")
            return JsonResponse({'error': 'Failed to send approval email.'}, status=500)

        return JsonResponse({'message': 'Registration successful. Awaiting admin approval.'}, status=201)

    logger.warning("Invalid request method used for registration.")
    return JsonResponse({'error': 'Invalid request'}, status=400)

@csrf_exempt
def database_schema_view(request):
    logger.info("Starting to retrieve database schema.")
    schema = []
    try:
        for model in apps.get_models():
            fields = [
                {
                    "name": field.name,
                    "type": field.get_internal_type(),
                    "nullable": field.null,
                    "related_model": field.related_model.__name__ if field.related_model else None,
                }
                for field in model._meta.get_fields()
            ]
            schema.append({
                "app_label": model._meta.app_label,
                "model_name": model.__name__,
                "fields": fields,
            })
        logger.info("Database schema successfully retrieved.")
    except Exception as e:
        logger.error(f"Error retrieving database schema: {e}")
        return JsonResponse({"error": "Failed to retrieve schema"}, status=500)
    return JsonResponse(schema, safe=False)

@csrf_exempt
def stratify_data_view(request):
    logger.info("Starting data stratification.")
    stratified_data = {}
    try:
        # Stratify data by different attributes
        stratified_data["by_sex"] = MasterData.objects.values('sex').annotate(count=Count('sex'))
        stratified_data["by_grade"] = MasterData.objects.values('grade_code').annotate(count=Count('grade_code'))
        stratified_data["by_topography"] = MasterData.objects.values('topography').annotate(count=Count('topography'))
        stratified_data["by_histology"] = MasterData.objects.values('histology').annotate(count=Count('histology'))
        stratified_data["by_behavior"] = MasterData.objects.values('behavior').annotate(count=Count('behavior'))
        stratified_data["by_basis_of_diagnosis"] = MasterData.objects.values('basis_of_diagnosis').annotate(count=Count('basis_of_diagnosis'))
        
        # Additional logging for each stratification type
        logger.info("Data stratified by 'sex', 'grade_code', 'topography', 'histology', 'behavior', and 'basis_of_diagnosis'.")
        
        # Convert queryset data to a list for JSON serialization
        for key, queryset in stratified_data.items():
            stratified_data[key] = list(queryset)
        
        logger.info("Data stratification completed successfully.")
    except Exception as e:
        logger.error(f"Error during data stratification: {e}")
        return JsonResponse({"error": "Failed to stratify data"}, status=500)
    
    return JsonResponse(stratified_data)



class LogReportView(APIView):
    def get(self, request):
        start_date = parse_date(request.query_params.get('start_date'))
        end_date = parse_date(request.query_params.get('end_date'))
        action = request.query_params.get('action')
        
        queryset = LogEntry.objects.all()
        
        if start_date:
            queryset = queryset.filter(timestamp__gte=start_date)
        if end_date:
            queryset = queryset.filter(timestamp__lte=end_date)
        if action:
            queryset = queryset.filter(action=action)
        
        data = [
            {
                "user": log.user.username if log.user else "System",
                "action": log.action,
                "timestamp": log.timestamp,
                "details": log.details,
            }
            for log in queryset
        ]
        
        return Response(data)
    
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
	# Delete token if token-based authentication is used
	if hasattr(request.user, 'auth_token'):
		request.user.auth_token.delete()

	# Invalidate the session if using session-based auth
	logout(request)

	return JsonResponse({"message": "Logged out successfully"}, status=200)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([JSONParser])
def admin_user_management(request):
    if request.method == 'GET':
        users = User.objects.all().values(
            'id', 'username', 'email', 'is_active', 'is_staff', 'is_superuser'
        )
        return Response(users, status=status.HTTP_200_OK)
    elif request.method == 'POST':
        user_id = request.data.get('user_id')
        is_active = request.data.get('is_active')
        is_staff = request.data.get('is_staff')
        is_superuser = request.data.get('is_superuser')
        
        try:
            user = User.objects.get(id=user_id)
            user.is_active = is_active
            user.is_staff = is_staff
            user.is_superuser = is_superuser
            user.save()
            return Response({"message": "User privileges updated successfully"}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
                
class ForgotPasswordView(APIView):
    def post(self, request):
        email = request.data.get("email")
        try:
            user = User.objects.get(email=email)
            # Generate a password reset token/link here (use Django's built-in reset if preferred)
            reset_link = f"http://localhost:8000/reset-password/{user.pk}/token"
            send_mail(
                subject="Password Reset Request",
                message=f"Click the link to reset your password: {reset_link}",
                from_email=[settings.DEFAULT_FROM_EMAIL],
                recipient_list=[settings.ADMIN_EMAIL],
            )
            return Response({'message': 'Password reset email sent.'}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({'error': 'User with that email not found.'}, status=status.HTTP_404_NOT_FOUND)