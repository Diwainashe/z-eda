from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import logging
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.authtoken.models import Token
from rest_framework.views import APIView
from rest_framework.response import Response
import pandas as pd
from rest_framework.parsers import MultiPartParser, FormParser
from .models import DataUpload
import os
from django.conf import settings
from rest_framework import status
import chardet
import numpy as np
from fuzzywuzzy import process
from difflib import get_close_matches


# Initialize logging for debugging
logging.basicConfig(level=logging.DEBUG)

def detect_encoding(file_path):
    """Detect file encoding using chardet."""
    with open(file_path, 'rb') as file:
        result = chardet.detect(file.read(10000))  # Read first 10,000 bytes
        return result['encoding']

# Utility function to read the uploaded file based on its format
def read_file(file_path, file_format):
    try:
        logging.info(f"Attempting to read the file at {file_path} as {file_format}")

        if file_format == 'csv':
            # Automatically detect encoding
            encoding = detect_encoding(file_path)
            logging.info(f"Detected encoding: {encoding}")

            # Try reading CSV with the detected encoding
            try:
                return pd.read_csv(file_path, encoding=encoding)
            except pd.errors.ParserError:
                # Handle possible delimiter or parsing issues
                logging.error("ParserError encountered while reading CSV.")
                return pd.read_csv(file_path, encoding=encoding, delimiter=';')  # Fallback to alternative delimiter if parsing fails
            except UnicodeDecodeError:
                # Handle encoding problems if detected encoding is incorrect
                logging.error("UnicodeDecodeError encountered while reading CSV.")
                return pd.read_csv(file_path, encoding='ISO-8859-1')  # Fallback to a common encoding if detection fails

        elif file_format in ['xlsx', 'xls']:
            return pd.read_excel(file_path, engine='openpyxl')

        elif file_format == 'json':
            return pd.read_json(file_path)

        else:
            raise ValueError("Unsupported file format")

    except Exception as e:
        logging.error(f"Error reading the file: {str(e)}")
        raise ValueError(f"Error reading the file: {str(e)}")

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

        # Store the file in the media folder
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

        # Build the file path to process it
        file_path = os.path.join(settings.MEDIA_ROOT, str(upload.file))
        logging.info(f"File saved at path: {file_path}")

        try:
            # Read the file using the helper function
            df = read_file(file_path, file_format)
            logging.info("File read successfully")

            # Replace NaN values with None (which translates to null in JSON)
            df = df.replace({np.nan: None})

            # Adding the `step` column to track the process
            df['step'] = 'Step 1: File Uploaded'

            # Return the first 15 rows as a preview
            data_preview = df.head(15).to_dict(orient='records')

            # Return the full dataset
            full_data = df.to_dict(orient='records')

            # Respond with the preview and the full dataset, including the `upload_id`
            return Response({
                "data": data_preview,
                "full_data": full_data,  # Full dataset to be passed for validation
                "upload_id": upload.id
            }, status=status.HTTP_200_OK)

        except ValueError as ve:
            logging.error(f"Data processing error: {str(ve)}")
            return Response({"error": f"Data processing error: {str(ve)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            logging.error(f"An unexpected error occurred: {str(e)}")
            return Response({"error": f"An unexpected error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

#Step 4: Code Correction
# Helper function to load JSON data
def load_json_data(file_path):
    with open(file_path, 'r') as f:
        return json.load(f)

# Function to find closest match with confidence score
def find_closest_match(value, valid_values, threshold=0.85):
    matches = get_close_matches(value, valid_values, n=1, cutoff=threshold)
    if matches:
        return matches[0], 100  # Assuming a high confidence score for now
    return value, 0  # Return original if no close match found

# Function to automatically correct or flag incorrect codes
def auto_correct_codes(dataset):
    corrections = {
        "topography": [],
        "histology": []
    }

    # Load JSON files for valid codes
    topography_codes = load_json_data(os.path.join(settings.BASE_DIR, 'api/data_files/topography_codes.json'))
    morphology_codes = load_json_data(os.path.join(settings.BASE_DIR, 'api/data_files/morphology_codes.json'))

    topography_values = topography_codes.values()
    morphology_values = morphology_codes.values()

    # Iterate through dataset records
    for record in dataset:
        histology = record.get("histology", "").strip()
        topography = record.get("topography", "").strip()

        # Auto-correct histology (morphology)
        if histology not in morphology_values:
            closest_match, score = find_closest_match(histology, morphology_values)
            if score >= 85:  # Use threshold value of 85
                record["histology"] = closest_match
                corrections["histology"].append({
                    "id": record["id"],
                    "original_value": histology,
                    "corrected_value": closest_match,
                    "confidence": score
                })

        # Auto-correct topography
        if topography not in topography_values:
            closest_match, score = find_closest_match(topography, topography_values)
            if score >= 85:
                record["topography"] = closest_match
                corrections["topography"].append({
                    "id": record["id"],
                    "original_value": topography,
                    "corrected_value": closest_match,
                    "confidence": score
                })

    return dataset, corrections

# Step 4: API View to handle auto-correction
class AutoCorrectCodesView(APIView):
    def post(self, request, *args, **kwargs):
        dataset = request.data.get('dataset')

        if not dataset:
            return Response({"error": "Dataset is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Run auto-correction on dataset
            corrected_data, corrections = auto_correct_codes(dataset)

            return Response({
                "corrected_data": corrected_data,
                "corrections": corrections
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"An error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Function to log corrections or flag for manual review
def log_corrections(corrections):
    if corrections["histology"]:
        print("Histology Auto-Corrections Applied:")
        for correction in corrections["histology"]:
            print(f"Record ID {correction['id']}: {correction['original_value']} -> {correction['corrected_value']} (Confidence: {correction['confidence']})")

    if corrections["topography"]:
        print("Topography Auto-Corrections Applied:")
        for correction in corrections["topography"]:
            print(f"Record ID {correction['id']}: {correction['original_value']} -> {correction['corrected_value']} (Confidence: {correction['confidence']})")




@csrf_exempt
def login_view(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)  # Load the JSON data
            username = data['username']
            password = data['password']

            user = authenticate(request, username=username, password=password)
            if user is not None:
                # Create a token if it doesn't exist
                token, created = Token.objects.get_or_create(user=user)
                return JsonResponse({'token': token.key}, status=status.HTTP_200_OK)
            else:
                return JsonResponse({'error': 'Invalid credentials'}, status=status.HTTP_400_BAD_REQUEST)
        except KeyError:
            return JsonResponse({'error': 'Missing username or password'}, status=status.HTTP_400_BAD_REQUEST)
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=status.HTTP_400_BAD_REQUEST)
    return JsonResponse({'error': 'Only POST requests are allowed'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
