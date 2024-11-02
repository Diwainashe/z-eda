import os
import json
import logging
import pandas as pd
from difflib import get_close_matches
from django.conf import settings
from rapidfuzz import process

# Utility function to read the uploaded file based on its format
def read_file(file_path, file_format):
    import chardet
    import numpy as np

    try:
        def detect_encoding(file_path):
            with open(file_path, 'rb') as file:
                result = chardet.detect(file.read(10000))
                return result['encoding']

        if file_format == 'csv':
            encoding = detect_encoding(file_path)
            df = pd.read_csv(file_path, encoding=encoding)
        elif file_format in ['xlsx', 'xls']:
            df = pd.read_excel(file_path, engine='openpyxl')
        elif file_format == 'json':
            df = pd.read_json(file_path)
        else:
            raise ValueError("Unsupported file format")

        return df.replace({np.nan: None})

    except Exception as e:
        logging.error(f"Error reading file: {str(e)}")
        raise ValueError(f"Error reading file: {str(e)}")
    
def find_closest_match(input_string, choices, threshold=0.85):
    """
    Finds the closest match to an input string from a list of choices using fuzzy matching.
    Returns the closest match and its similarity score.
    """
    if not input_string or not choices:  # Handle null or empty input
        return None, 0

    # Perform fuzzy matching
    closest_match, score, _ = process.extractOne(input_string, choices)

    # Convert score to a percentage for consistency
    score_percentage = score / 100.0

    if score_percentage >= threshold:
        return closest_match, score
    else:
        return None, 0
    
def find_close_match(input_string, choices, threshold=0.75):
    """
    Finds the closest match to an input string from a list of choices using fuzzy matching.
    Returns the closest match and its similarity score.
    """
    if not input_string or not choices:  # Handle null or empty input
        return None, 0

    # Perform fuzzy matching
    closest_match, score, _ = process.extractOne(input_string, choices)

    # Convert score to a percentage for consistency
    score_percentage = score / 100.0

    if score_percentage >= threshold:
        return closest_match, score
    else:
        return None, 0

def preprocess_and_load_json(file_path):
    """
    Loads and preprocesses JSON data from a file.
    """
    try:
        abs_file_path = os.path.join(settings.BASE_DIR, file_path)
        logging.info(f"Loading JSON file from: {abs_file_path}")

        with open(abs_file_path, 'r', encoding='utf-8-sig') as f:
            content = json.load(f)

        if 'morphology' in file_path:
            return {value: key for key, value in content.items()}
        
        return content

    except Exception as e:
        logging.error(f"Error loading JSON file {file_path}: {str(e)}")
        return {}

def auto_correct_codes(dataset, threshold=0.7):
    """
    Auto-corrects topography and histology codes in the dataset using fuzzy matching.
    """
    corrections = {
        "topography": [],
        "histology": []
    }

    # Load and preprocess JSON data
    topography_codes = preprocess_and_load_json('api/data_files/topography_codes.json') or {}
    morphology_codes = preprocess_and_load_json('api/data_files/morphology_codes.json') or {}

    topography_values = list(topography_codes.values())  # Topography descriptions
    morphology_values = list(morphology_codes.values())  # Morphology descriptions

    for record in dataset:
        histology = record.get("histology", "").strip() or None
        topography = record.get("topography", "").strip() or None

        # Auto-correct histology
        if histology and histology not in morphology_values:
            closest_match, score = find_closest_match(histology, morphology_values, threshold)
            if closest_match:
                corrected_key = list(morphology_codes.keys())[list(morphology_codes.values()).index(closest_match)]
                record["histology"] = corrected_key
                corrections["histology"].append({
                    "id": record.get("registration_number", "N/A"),
                    "original_value": histology,
                    "corrected_value": corrected_key,
                    "confidence": score
                })

        # Auto-correct topography
        if topography and topography not in topography_codes:
            # Try matching the full topography string
            closest_match, score = find_closest_match(topography, topography_values, threshold)
            
            if not closest_match:  # If no strong match is found for the whole string
                # Split the topography into words and find the best match for each
                words = topography.split()
                best_match = None
                best_score = 0

                for word in words:
                    match, word_score = find_closest_match(word, topography_values, threshold)
                    if word_score > best_score:
                        best_match = match
                        best_score = word_score

                # Use the best match found among the words
                closest_match, score = best_match, best_score

            if closest_match:
                corrected_key = list(topography_codes.keys())[list(topography_codes.values()).index(closest_match)]
                record["topography"] = corrected_key
                corrections["topography"].append({
                    "id": record.get("registration_number", "N/A"),
                    "original_value": topography,
                    "corrected_value": corrected_key,
                    "confidence": score
                })

    log_corrections(corrections)
    return dataset, corrections


def log_corrections(corrections):
    """
    Logs the corrections made during the auto-correction process.
    """
    if corrections["histology"]:
        logging.info("Histology Corrections Applied:")
        for correction in corrections["histology"]:
            logging.info(f"Record ID {correction['id']}: {correction['original_value']} -> {correction['corrected_value']} (Confidence: {correction['confidence']})")

    if corrections["topography"]:
        logging.info("Topography Corrections Applied:")
        for correction in corrections["topography"]:
            logging.info(f"Record ID {correction['id']}: {correction['original_value']} -> {correction['corrected_value']} (Confidence: {correction['confidence']})")


