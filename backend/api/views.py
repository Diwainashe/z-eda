from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.authtoken.models import Token
from rest_framework import status
import logging
import json
import os
from rest_framework.authtoken.views import ObtainAuthToken

from django.contrib.auth import authenticate
from django.conf import settings
from .models import DataUpload
from .utils import read_file, auto_correct_codes, run_all_validations  # Import only the needed functions
from .tasks import run_all_validations_task 
import uuid

# Initialize logging for debugging
logging.basicConfig(level=logging.DEBUG)

# Step 1: Data Upload with Validation Preparation
class DataUploadView(APIView):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file = request.FILES.get('file')
        file_format = request.data.get('file_format')

        if not file or not file_format:
            return Response({"error": "File and file format are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            logging.info(f"Saving file for user {request.user.username}")
            upload = DataUpload.objects.create(
                user=request.user,
                file=file,
                file_format=file_format,
                step="Step 1: File Uploaded"
            )
        except Exception as e:
            logging.error(f"Error saving file: {str(e)}")
            return Response({"error": f"Error saving file: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        file_path = os.path.join(settings.MEDIA_ROOT, str(upload.file))
        logging.info(f"File saved at path: {file_path}")

        try:
            df = read_file(file_path, file_format)
            logging.info("File read successfully")
            df['step'] = 'Step 1: File Uploaded'
            data_preview = df.head(15).to_dict(orient='records')
            full_data = df.to_dict(orient='records')

            return Response({
                "data": data_preview,
                "full_data": full_data,
                "upload_id": upload.id
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logging.error(f"Data processing error: {str(e)}")
            return Response({"error": f"Data processing error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Step 4: Auto-Correction
# API View to handle the auto-correction process
class AutoCorrectCodesView(APIView):
    def post(self, request, *args, **kwargs):
        try:
            dataset = request.data.get('dataset')
            if not dataset:
                return Response({"error": "Dataset is required."}, status=status.HTTP_400_BAD_REQUEST)

            # Run auto-correction on dataset
            corrected_data, corrections = auto_correct_codes(dataset)

            # Check if corrections failed due to missing JSON data
            if corrected_data is None:
                return Response(
                    {"error": corrections},  # corrections here contains the error message
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            return Response({
                "corrected_data": corrected_data,
                "corrections": corrections
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logging.error(f"An error occurred: {str(e)}")
            return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RunAllValidationsAPIView(APIView):
    """
    API endpoint to initiate all validations.
    """

    def post(self, request, format=None):
        """
        Initiates the validation process.
        Expects 'dataset' in the request data.
        """
        # Extract dataset from the request body
        dataset = request.data.get('dataset', [])

        if not dataset:
            return Response({"error": "No dataset provided."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Generate a unique ID for tracking
        validation_id = str(uuid.uuid4())
        
        # Trigger Celery task
        run_all_validations_task.delay(validation_id, dataset)
        
        return Response({
            "validation_id": validation_id,
            "results": []  # Initialize as empty array; will be updated via WebSocket or other means
        }, status=202)

@csrf_exempt
def login_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data['username']
            password = data['password']

            user = authenticate(request, username=username, password=password)
            if user is not None:
                token, created = Token.objects.get_or_create(user=user)
                return JsonResponse({'token': token.key}, status=status.HTTP_200_OK)
            else:
                return JsonResponse({'error': 'Invalid credentials'}, status=status.HTTP_400_BAD_REQUEST)

        except KeyError:
            return JsonResponse({'error': 'Missing username or password'}, status=status.HTTP_400_BAD_REQUEST)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=status.HTTP_400_BAD_REQUEST)

    return JsonResponse({'error': 'Only POST requests are allowed'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

class CustomObtainAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        response = Response({'token': token.key})
        # Set token in httpOnly cookie
        response.set_cookie(
            key='auth_token',
            value=token.key,
            httponly=True,
            secure=False,  # Set to True in production
            samesite='Lax',
        )
        return response
    
class CheckAuthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'authenticated': True, 'username': request.user.username}, status=200)