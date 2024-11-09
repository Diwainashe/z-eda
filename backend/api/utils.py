import os
import json
import logging
import pandas as pd
from django.conf import settings
from rapidfuzz import process
from datetime import datetime
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import chardet
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s:%(message)s')

logger = logging.getLogger(__name__)

# Utility function to read the uploaded file based on its format
def read_file(file_path, file_format):
    try:
        logging.info(f"Starting to read file: {file_path} with format: {file_format}")

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        # Detect encoding for CSV files
        def detect_encoding(file_path):
            with open(file_path, 'rb') as file:
                result = chardet.detect(file.read(10000))
                return result['encoding']

        # Read file based on format
        if file_format == 'csv':
            encoding = detect_encoding(file_path)
            logging.info(f"Detected encoding: {encoding}")
            df = pd.read_csv(file_path, encoding=encoding)
        elif file_format in ['xlsx', 'xls']:
            df = pd.read_excel(file_path, engine='openpyxl')
        elif file_format == 'json':
            df = pd.read_json(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_format}")

        logging.info(f"Successfully read file: {file_path} with shape {df.shape}")
        return df.replace({np.nan: None})

    except Exception as e:
        logging.error(f"Error reading file '{file_path}': {str(e)}", exc_info=True)
        raise
    
def preprocess_and_load_json(file_path):
    try:
        abs_file_path = os.path.join(settings.BASE_DIR, file_path)
        
        if not os.path.exists(abs_file_path):
            raise FileNotFoundError(f"JSON file not found: {abs_file_path}")

        logging.info(f"Loading JSON file from: {abs_file_path}")
        with open(abs_file_path, 'r', encoding='utf-8-sig') as f:
            content = json.load(f)

        # Reverse key-value pairs if the filename includes 'morphology'
        if 'morphology' in file_path:
            content = {value: key for key, value in content.items()}

        # Log a preview of the first four items if the content is not empty
        if content:
            preview = list(content.items())[:4]
            logging.info(f"Preview of codes (up to 4): {preview}")

        return content

    except Exception as e:
        logging.error(f"Error loading JSON file '{file_path}': {str(e)}", exc_info=True)
        return {}


def find_closest_match(input_string, choices, threshold=0.85):
    """
    Finds the closest match to an input string from a list of choices using fuzzy matching.
    Returns the closest match and its similarity score (as a percentage).
    """
    # Validate input types
    if not isinstance(input_string, str) or not isinstance(choices, list):
        logging.warning("Invalid input types: 'input_string' should be str and 'choices' should be list.")
        return None, 0
    
    if not input_string or not choices:  # Handle null or empty input
        return None, 0

    try:
        # Perform fuzzy matching
        closest_match, score, _ = process.extractOne(input_string, choices)
        
        # Convert score to a percentage
        score_percentage = score / 100.0
        logging.info(f"Matching '{input_string}' -> Closest match: '{closest_match}' with score: {score_percentage:.2f}")

        if score_percentage >= threshold:
            return closest_match, score_percentage
        else:
            return None, 0
    except Exception as e:
        logging.error(f"Error finding closest match for '{input_string}': {str(e)}", exc_info=True)
        return None, 0

def auto_correct_sex(value, sex_codes):
    """
    Normalizes sex input to standard codes based on a provided dictionary.
    
    Args:
        value (str): The sex/gender input to normalize.
        sex_codes (dict): Dictionary mapping 'male' and 'female' to standard codes.
    
    Returns:
        str: The normalized sex code.
    """
    try:
        value = value.strip().lower()
        logging.info(f"Auto-correcting sex input: '{value}'")

        # Check common variations for male
        if value in ["male", "m", "1"]:
            normalized_value = sex_codes.get("male", value)
            logging.info(f"Normalized '{value}' to '{normalized_value}' (male)")
            return normalized_value

        # Check common variations for female
        elif value in ["female", "f", "0"]:
            normalized_value = sex_codes.get("female", value)
            logging.info(f"Normalized '{value}' to '{normalized_value}' (female)")
            return normalized_value

        logging.info(f"No match found for '{value}', returning original.")
        return value  # Return the original if no match is found
    except Exception as e:
        logging.error(f"Error auto-correcting sex value '{value}': {str(e)}", exc_info=True)
        return value

def auto_correct_codes(dataset, threshold=0.7):
    """
    Auto-corrects topography, histology, sex, behavior, and grade codes in the dataset using fuzzy matching.
    """
    try:
        logging.info("Starting auto-correction of codes.")
        corrections = {
            "topography": [],
            "histology": [],
            "sex": [],
            "behavior": [],
            "grade": []
        }

        # Load and preprocess JSON data
        topography_codes = preprocess_and_load_json('api/data_files/topography_codes.json') or {}
        morphology_codes = preprocess_and_load_json('api/data_files/morphology_codes.json') or {}
        sex_codes = preprocess_and_load_json('api/data_files/sex.json') or {}
        behavior_codes = preprocess_and_load_json('api/data_files/behavior_codes.json') or {}
        grade_codes = preprocess_and_load_json('api/data_files/grade_codes.json') or {}

        topography_values = list(topography_codes.values())  # Topography descriptions
        morphology_values = list(morphology_codes.values())  # Morphology descriptions

        total_records = len(dataset)
        for idx, record in enumerate(dataset, start=1):
            logging.info(f"Auto-correcting record {idx}/{total_records}")
            histology = record.get("histology", "").strip() or None
            topography = record.get("topography", "").strip() or None
            sex = record.get("sex", "").strip() or None
            behavior = record.get("behavior", "").strip() or None
            grade = record.get("grade_code", "").strip() or None

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
                closest_match, score = find_closest_match(topography, topography_values, threshold)
                if not closest_match:  # If no strong match is found for the whole string
                    words = topography.split()
                    best_match = None
                    best_score = 0

                    for word in words:
                        match, word_score = find_closest_match(word, topography_values, threshold)
                        if word_score > best_score:
                            best_match = match
                            best_score = word_score

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

            # Auto-correct sex
            if sex:
                corrected_sex = auto_correct_sex(sex, sex_codes)
                if corrected_sex != sex:
                    record["sex"] = corrected_sex
                    corrections["sex"].append({
                        "id": record.get("registration_number", "N/A"),
                        "original_value": sex,
                        "corrected_value": corrected_sex
                    })

            # Auto-correct behavior
            if behavior:
                corrected_behavior = behavior_codes.get(behavior.capitalize(), behavior)
                if corrected_behavior != behavior:
                    record["behavior"] = corrected_behavior
                    corrections["behavior"].append({
                        "id": record.get("registration_number", "N/A"),
                        "original_value": behavior,
                        "corrected_value": corrected_behavior
                    })

            # Auto-correct grade
            if grade:
                corrected_grade = grade_codes.get(grade.upper(), grade)
                if corrected_grade != grade:
                    record["grade_code"] = corrected_grade
                    corrections["grade"].append({
                        "id": record.get("registration_number", "N/A"),
                        "original_value": grade,
                        "corrected_value": corrected_grade
                    })

        log_corrections(corrections)
        logging.info("Completed auto-correction of codes.")
        return dataset, corrections

    except Exception as e:
        logging.error(f"Error in auto_correct_codes: {str(e)}", exc_info=True)
        raise
        return value, None

def log_corrections(corrections):
    try:
        for correction_type, correction_list in corrections.items():
            if correction_list:
                logging.info(f"{correction_type.capitalize()} Corrections Applied:")
                for correction in correction_list:
                    logging.info(
                        f"Record ID {correction['id']}: {correction['original_value']} -> {correction['corrected_value']} "
                        f"(Confidence: {correction.get('confidence', 'N/A')})"
                    )
    except Exception as e:
        logging.error(f"Error logging corrections: {str(e)}", exc_info=True)


def run_validations(dataset):
    """
    Runs validation checks for sex, behavior, grade, topography, and morphology.
    """
    
    try:
        logging.info("Starting individual item validations.")
        results = []
        
        sex_codes = preprocess_and_load_json('api/data_files/sex.json') or {}
        behavior_codes = preprocess_and_load_json('api/data_files/behavior_codes.json') or {}
        grade_codes = preprocess_and_load_json('api/data_files/grade_codes.json') or {}
        topography_codes = preprocess_and_load_json('api/data_files/topography_codes.json') or {}
        morphology_codes = preprocess_and_load_json('api/data_files/morphology_codes.json') or {}

        total_records = len(dataset)
        for index, record in enumerate(dataset, start=1):
            logging.info(f"Validating record {index}/{total_records}")
            record["is_valid"] = True
            record["validation_results"] = []

            def log_error(field, message):
                record["is_valid"] = False
                record["validation_results"].append(f"{field}: {message}")

            # Validate sex
            sex = record.get("sex")
            if sex not in sex_codes.values():               
                log_error("sex", f"Invalid sex code: {sex}")
            else:
                record["validation_results"].append(f"Valid sex code: {sex}")

            # Validate behavior
            behavior = record.get("behavior")
            if behavior not in behavior_codes.values():
                log_error("behavior", f"Invalid behavior code: {behavior}")            
            else:
                record["validation_results"].append(f"Valid behavior code: {behavior}")

            # Validate grade
            grade = record.get("grade_code")
            if grade not in grade_codes.values():
                log_error("grade", f"Invalid sex code: {grade}")
            else:
                record["validation_results"].append(f"Valid sex code: {grade}")

            # Validate topography
            topography = record.get("topography")
            if topography not in topography_codes.keys():
                log_error("topography", f"Invalid sex code: {topography}")
            else:
                record["validation_results"].append(f"Valid sex code: {topography}")

            # Validate morphology
            histology = record.get("histology")
            if histology not in morphology_codes.keys():
                log_error("histology", f"Invalid sex code: {histology}")
            else:
                record["validation_results"].append(f"Valid sex code: {histology}")
                
            # Add the record log
            results.append(record)


        logging.info("Completed individual item validations.")
        return results

    except Exception as e:
        logging.error(f"Error in run_validations: {str(e)}", exc_info=True)
        raise


def calculate_age_at_incidence(birth_date, date_of_incidence):
    """
    Calculate the age of the patient at the date of incidence.
    """
    try:
        # Parse the dates from the strings
        birth_date = datetime.strptime(birth_date, "%d/%m/%Y")
        date_of_incidence = datetime.strptime(date_of_incidence, "%d/%m/%Y")
        
        # Calculate age at incidence
        age_at_incidence = date_of_incidence.year - birth_date.year

        # Adjust for the month and day if the birth date hasn't occurred yet this year
        if (date_of_incidence.month, date_of_incidence.day) < (birth_date.month, birth_date.day):
            age_at_incidence -= 1

        return age_at_incidence

    except Exception as e:
        logging.error(f"Error calculating age at incidence: {str(e)}", exc_info=True)
        return None


def update_dataset_with_age(dataset):
    """
    Updates the dataset by adding the calculated age at incidence to each record.
    """
    try:
        logging.info("Calculating age at incidence for all records.")
        for record in dataset:
            birth_date = record.get("birth_date")
            date_of_incidence = record.get("date_of_incidence")
            
            # Calculate age at incidence if both dates are present
            if birth_date and date_of_incidence:
                record["age_at_incidence"] = calculate_age_at_incidence(birth_date, date_of_incidence)

        logging.info("Completed calculating age at incidence.")
        return dataset

    except Exception as e:
        logging.error(f"Error in update_dataset_with_age: {str(e)}", exc_info=True)
        raise


def normalize_histology_code(code):
    """
    Strips the '/#' suffix from the histology code to retain only the numeric part.
    """
    try:
        if code and isinstance(code, str):
            return code.split('/')[0]  # Keep only the part before '/'
        return code
    except Exception as e:
        logging.error(f"Error normalizing histology code '{code}': {str(e)}", exc_info=True)
        return code


def run_data_combination_edits(dataset):
    """
    Runs validation checks for data combinations like age/site, age/histology, etc.
    """
    try:
        logging.info("Starting data combination validations.")
        results = []
        
        dataset = update_dataset_with_age(dataset)

        # Define the childhood tumor checks with normalized histology codes
        childhood_tumour_checks = [
            {"diagnostic_group": ["9650", "9651", "9652", "9653", "9655"], "age_range": (0, 2)},  # Hodgkin lymphoma
            {"diagnostic_group": ["9500", "9501", "9502"], "age_range": (10, 14)},  # Neuroblastoma
            {"diagnostic_group": ["9510", "9511", "9512"], "age_range": (6, 14)},  # Retinoblastoma
            {"diagnostic_group": ["8960", "8961"], "age_range": (9, 14)},  # Wilms’ tumour
            {"diagnostic_group": ["8310", "8312"], "age_range": (0, 8)},  # Renal carcinoma
            {"diagnostic_group": ["8970"], "age_range": (6, 14)},  # Hepatoblastoma
            {"diagnostic_group": ["8170", "8171"], "age_range": (0, 8)},  # Hepatic carcinoma
            {"diagnostic_group": ["9180", "9181", "9183"], "age_range": (0, 5)},  # Osteosarcoma
            {"diagnostic_group": ["9220", "9240"], "age_range": (0, 5)},  # Chondrosarcoma
            {"diagnostic_group": ["9260", "9261"], "age_range": (0, 3)},  # Ewing sarcoma
            {"diagnostic_group": ["9064", "9065", "9070", "9071", "9072"], "age_range": (8, 14)},  # Non-gonadal germ cell
            {"diagnostic_group": ["8323", "8324"], "age_range": (0, 14)},  # Gonadal carcinoma
            {"diagnostic_group": ["8340", "8341"], "age_range": (0, 5)},  # Thyroid carcinoma
            {"diagnostic_group": ["8070", "8071"], "age_range": (0, 5)},  # Nasopharyngeal carcinoma
            {"diagnostic_group": ["8090", "8091"], "age_range": (0, 4)},  # Skin carcinoma
            {"diagnostic_group": ["8010", "8011"], "age_range": (0, 4)},  # Carcinoma, NOS
            {"diagnostic_group": ["9050", "9051", "9052"], "age_range": (0, 14)},  # Mesothelial neoplasms (M905_)
        ]
        
        # Age/Site Checks
        age_site_checks = [
            {"site": "C61", "histology_prefix": "814", "age_range": (15, 39)},  # Prostate carcinoma unlikely <40
            {"site": "C17", "histology_max": 9589, "age_range": (0, 19)},  # Rare for site C17 and histology <9590 <20
            {"site": "C33", "histology_prefix": "824", "age_range": (0, 19)},  # Colon histology 824+ unlikely <20
            {"site": "C58", "histology": "9100", "age_range": (46, 100)},  # Site C58 with histology 9100 rare >45
        ]
        
        # Sex/Site Checks
        sex_site_checks = [
            {"sex": "Male", "sites": ["C51", "C52", "C53", "C54", "C55", "C56", "C57", "C58"]},  # Female-specific sites in males
            {"sex": "Female", "sites": ["C60", "C61", "C62", "C63"]},  # Male-specific sites in females
        ]
        
        # **Updated: Sex/Histology Checks Based on Histological Families**
        sex_histology_checks = [
            {"sex": "Male", "histological_families": ["23", "24", "25", "26", "27"]},  # Female-only histological families in males
            {"sex": "Female", "histological_families": ["28", "29"]},  # Male-only histological families in females
        ]
        
        # Behavior/Site Checks
        behavior_site_checks = [
            {"behavior": "2", "sites": ["C40", "C41", "C42", "C47", "C49", "C70", "C71", "C72"]},  # In-situ behavior unlikely for these sites
        ]
        
        # Behavior/Histology Checks
        behavior_histology_checks = [
            {"behavior": "2", "histologies": ["8910", "8960", "8970", "8981", "8991", "9072", "9470"]},  # In-situ behavior unlikely
        ]
        
        # Grade/Histology Checks
        grade_histology_checks = [
            {"grade": "1", "histologies": ["8140", "8500"]},  # Specific grade-histology combos
            {"grade": "3", "histologies": ["9702", "9714"]},  # High-grade tumors aligning with specific histologies
        ]
        
        # Basis of Diagnosis/Histology Checks
        basis_histology_checks = [
            {"basis_of_diagnosis": "Histology", "histologies": ["8000", "8150", "9100"]},  # Histology-based diagnoses
            {"basis_of_diagnosis": "Clinical", "histologies": ["9590", "9591"]},  # Clinical-based diagnoses for certain histologies
        ]

        total_records = len(dataset)
        for index, record in enumerate(dataset, start=1):
            logging.info(f"Running data combination validations for record {index}/{total_records}")
            record.setdefault("is_valid", True)
            record.setdefault("validation_results", [])
            
            def log_combination_error(field, message):
                record["is_valid"] = False
                record["validation_results"].append(f"{field}: {message}")

            # Extract relevant fields
            age = record.get("age_at_incidence")
            site = record.get("topography")
            histology = normalize_histology_code(record.get("histology"))
            sex = record.get("sex")
            behavior = record.get("behavior")
            grade = record.get("grade_code")
            basis_of_diagnosis = record.get("basis_of_diagnosis")
            birth_date = record.get("birth_date")
            incidence_date = record.get("date_of_incidence")

            # **Childhood Tumor Checks**
            for tumour_check in childhood_tumour_checks:
                if histology in tumour_check["diagnostic_group"] and age is not None:
                    if not (tumour_check["age_range"][0] <= age <= tumour_check["age_range"][1]):
                        log_combination_error("histology", f"Histology {histology} unlikely for age {age} (expected age range: {tumour_check['age_range']})")
                    else:
                        record["validation_results"].append(f"Valid diagnostic group: {histology}")

            # **Unlikely Combinations for age > 15**
                if age is not None and age > 15:
                    if age < 40 and site.startswith("C61") and histology.startswith("814"):
                        log_combination_error("combination", f"Age < 40 with site C61._ and histology 814_ is unlikely")
                    else:
                        record["validation_results"].append(f"Valid Age/Histology combination: {histology}")
                        
                    if age < 20 and site in [
                        "C15", "C19", "C20", "C21", "C23", "C24", "C38.4", "C50", "C53", "C54", "C55"
                    ]:
                        log_combination_error("combination", f"Age < 20 with site {site} is unlikely")
                    else:
                        record["validation_results"].append(f"Valid Age/Topography combination: {histology}")
                        
                    if age < 20 and site.startswith("C17") and histology.isdigit() and int(histology) < 9590:
                        log_combination_error("combination", f"Age < 20 with site {site} and histology {histology} is unlikely")
                    else:
                        record["validation_results"].append(f"Valid Age/Histology combination: {histology}")
                        
                    if age < 20 and site in ["C33", "C34", "C18"] and (not histology.startswith("824") if histology else True):
                        log_combination_error("combination", f"Age < 20 with site {site} and histology {histology} is unlikely")
                    else:
                        record["validation_results"].append(f"Valid Age/Site/Histology combination: {site}, {histology}")
                        
                    if age > 45 and site.startswith("C58") and histology == "9100":
                        log_combination_error("combination", f"Age > 45 with site C58._ and histology 9100 is unlikely")
                    else:
                        record["validation_results"].append(f"Valid Age/Site/Histology combination: {site}, {histology}")
                        
                    if age <= 25 and histology in ["9732", "9823"]:
                        log_combination_error("combination", f"Age <= 25 with histology {histology} is unlikely")
                    else:
                        record["validation_results"].append(f"Valid Age/Histology combination:{histology}")
                        
                    if histology in ["8910", "8960", "8970", "8981", "8991", "9072", "9470",
                                    "9510", "9511", "9512", "9513", "9514", "9515",
                                    "9516", "9517", "9518", "9519"]:
                        log_combination_error("combination", f"Age > 15 with histology {histology} is unlikely")
                    else:
                        record["validation_results"].append(f"Valid Age/Histology combination: {histology}")
            
            # **Age/Site Checks**
            for check in age_site_checks:
                if site and site.startswith(check["site"]) and age is not None:
                    if "histology_prefix" in check and histology.startswith(check["histology_prefix"]):
                        if not (check["age_range"][0] <= age <= check["age_range"][1]):
                            log_combination_error("combination", f"Site {site} and histology {histology} unlikely for age {age} (expected age range: {check['age_range']})")
                    
                    elif "histology_max" in check and histology.isdigit() and int(histology) <= check["histology_max"]:
                        if not (check["age_range"][0] <= age <= check["age_range"][1]):
                            log_combination_error("combination", f"Site {site} and histology {histology} unlikely for age {age} (expected age range: {check['age_range']})")
                    else:
                        record["validation_results"].append(f"Valid diagnostic group: {histology}")

            # **Sex/Sex-Histology Checks**
            # Extract the first two digits of the histology code to determine the histological family
            histological_family = histology[:2] if histology and len(histology) >= 2 else None

            for check in sex_histology_checks:
                if sex and histological_family and sex in check["sex"] and histological_family in check["histological_families"]:
                    log_combination_error("combination", f"Histological family {histological_family} is unlikely for sex {sex}.")
                else:
                        record["validation_results"].append(f"Valid diagnostic group: {histology}")

            # **Sex/Site Checks**
            for check in sex_site_checks:
                if sex == check["sex"] and site in check["sites"]:
                    log_combination_error("combination", f"Site: {site} not possible for sex: {sex}.")
                else:
                        record["validation_results"].append(f"Valid diagnostic group: {histology}")

            # **Behavior/Site Checks**
            for check in behavior_site_checks:
                if behavior == check["behavior"] and site in check["sites"]:
                    log_combination_error("combination", f"Behavior: {behavior} unlikely with site: {site}.")
                else:
                        record["validation_results"].append(f"Valid diagnostic group: {histology}")

            # **Behavior/Histology Checks**
            for check in behavior_histology_checks:
                if behavior == check["behavior"] and histology in check["histologies"]:
                    log_combination_error("combination", f"Behavior: {behavior} unlikely with histology: {histology}.")
                else:
                        record["validation_results"].append(f"Valid diagnostic group: {histology}")

            # **Grade/Histology Checks**
            for check in grade_histology_checks:
                if grade == check["grade"] and histology in check["histologies"]:
                    log_combination_error("combination", f"Grade: {grade} unlikely with histology: {histology}.")
                else:
                        record["validation_results"].append(f"Valid diagnostic group: {histology}")

            # **Basis of Diagnosis/Histology Checks**
            for check in basis_histology_checks:
                if basis_of_diagnosis == check["basis_of_diagnosis"] and histology in check["histologies"]:
                    log_combination_error("combination", f"Basis of diagnosis: {basis_of_diagnosis} unlikely with histology: {histology}.")
                else:
                        record["validation_results"].append(f"Valid diagnostic group: {histology}")
                    
            # **Incidence/Birth Date Check**
            if birth_date and incidence_date:
                try:
                    birth_date_obj = pd.to_datetime(birth_date, dayfirst=True, errors='coerce')
                    incidence_date_obj = pd.to_datetime(incidence_date, dayfirst=True, errors='coerce')
                    
                    if pd.notna(birth_date_obj) and pd.notna(incidence_date_obj):
                        if incidence_date_obj <= birth_date_obj:
                            log_combination_error("combination", f"Date of incidence cannot be before or equal to the birth date.")
                    else:
                        record["validation_results"].append(f"Valid diagnostic group: {histology}")
                except Exception as e:
                    log_combination_error("combination", f"Date parsing error: {e}")

            
                results.append(record)

        logging.info("Completed data combination validations.")
        return results

    except Exception as e:
        logging.error(f"Error in run_data_combination_edits: {str(e)}", exc_info=True)
        raise


def run_site_morphology_edits(dataset):
    """
    Runs validation checks for site-morphology combinations.
    """
    try:
        logging.info("Starting site-morphology validations.")
        results = []

        # Site-Morphology Checks
        site_morphology_checks = [
            {"sites": ["C07", "C08"], "morphologies": ["8561", "8974"]},  # Salivary gland tumours
            {"sites": ["C16"], "morphologies": ["8142", "8214"]},  # Stomach tumours
            {"sites": ["C17"], "morphologies": ["8683", "9764"]},  # Small intestine tumours
            {"sites": ["C18", "C19", "C20", "C26", "C76.2", "C76.3", "C76.7", "C76.8", "C80"], 
             "morphologies": ["8213", "8220", "8261"]},  # Colo-rectal tumours
            {"sites": ["C20", "C21"], "morphologies": ["8124", "8215"]},  # Anal tumours
            {"sites": ["C15", "C16", "C17", "C18", "C19", "C20", "C26", "C76.2", "C76.3", "C76.7", "C76.8", "C80"], 
             "morphologies": ["8144", "8145", "8221", "8936", "9717"]},  # Gastrointestinal tumours
            {"sites": ["C22"], "morphologies": ["8170", "8171", "8172", "8173", "8174", "8175", "8970", "9124"]},  # Liver tumours
            {"sites": ["C22", "C23", "C24"], "morphologies": ["8160", "8161", "8162", "8180", "8264"]},  # Biliary tumours
            {"sites": ["C25"], "morphologies": ["8150", "8151", "8152", "8154", "8155", "8202", "8452", "8453", "8971"]},  # Pancreatic tumours
            {"sites": ["C30", "C31"], "morphologies": ["9520", "9521", "9522", "9523"]},  # Olfactory tumours
            {"sites": ["C34", "C39.8", "C39.9", "C76.1", "C76.7", "C76.8", "C80"], 
             "morphologies": ["8012", "8040", "8041", "8042", "8043", "8044", "8045", "8046", "8250", "8252", "8253", 
                              "8254", "8255", "8827", "8972"]},  # Lung tumours
            {"sites": ["C34", "C38.4", "C39.8", "C39.9", "C48", "C76.1", "C76.2", "C76.3", "C76.7", "C76.8", "C80"], 
             "morphologies": ["8973", "9050", "9051", "9052", "9053", "9055"]},  # Mesotheliomas & pleuropulmonary Blastomas
            {"sites": ["C37", "C38"], "morphologies": ["8580", "8581", "8582", "8583", "8584", "8585", "8586", "8587", "8588", "8589", "9679"]},  # Thymus tumours
            {"sites": ["C39", "C40", "C41", "C49", "C76", "C80"], 
             "morphologies": ["9365"]},  # Askin tumours
            {"sites": ["C40.0", "C40.2", "C40.8", "C40.9"], "morphologies": ["9261"]},  # Adamantinomas of long bones
            {"sites": ["C44", "C51", "C60", "C63.2", "C69", "C70", "C76", "C80"], 
             "morphologies": ["8720", "8721", "8722", "8723", "8725", "8727", "8730", "8740", "8741", "8742", "8743", 
                              "8744", "8745", "8746", "8750", "8760", "8761", "8762", "8770", "8771", "8772", "8780"]},  # Naevi and Melanomas
            {"sites": ["C51", "C52", "C53", "C54", "C55", "C56", "C57", "C58", "C62", "C63.8", "C63.9", "C75.0", "C75.1", 
                      "C75.2", "C75.4", "C75.5", "C75.8", "C75.9"], 
             "morphologies": ["8905", "8930", "8931", "8934", "8950", "8951", "8960", "8964", "8965", "8966", "8967", 
                              "8980", "8981", "8982", "8802", "8810", "8811", "8813", "8814", "8815", "8820", 
                              "8821", "8822", "8823", "8824", "8825", "8826", "8830", "8840", "8841", "8842", "8850", 
                              "8851", "8852", "8853", "8854", "8855", "8856", "8857", "8858", "8860", "8861", "8862", 
                              "8870", "8880", "8881", "8890", "8891", "8892", "8893", "8894", "8895", "8896", "8897", 
                              "8900", "8901", "8902", "8903", "8904", "8910", "8912", "8920", "8921", "8990", "8991", 
                              "9132"]},  # Adenosarcomas and Mesonephromas
            {"sites": ["C50", "C53", "C54", "C55", "C56", "C57", "C76.1", "C76.2", "C76.3", "C76.7", "C76.8", "C80"], 
             "morphologies": ["8935"]},  # Stromal sarcomas
            {"sites": ["C40", "C41", "C49", "C76", "C80"], 
             "morphologies": ["9040", "9041", "9042", "9043", "9044", "9251", "9252", "9260"]},  # Tumours of bone and connective tissue
            {"sites": ["C30.0", "C31", "C32.3", "C32.8", "C32.9", "C33.9", "C39", "C40", "C41", "C49", "C76", "C80"], 
             "morphologies": ["9220", "9221", "9230", "9231", "9240", "9241", "9242", "9243"]},  # Chondromatous tumours
            {"sites": ["C21", "C51", "C52", "C53", "C61"], 
             "morphologies": ["8077", "8148"]},  # Intraepithelial tumours
            {"sites": ["C11", "C14", "C20", "C21", "C26", "C30", "C61"], 
             "morphologies": ["8120", "8121", "8122", "8130", "8131"]},  # Transitional cell tumours
            {"sites": ["C06.9", "C07", "C08", "C21", "C22", "C23", "C24", "C25", "C26.8", "C26.9", "C50", "C61"], 
             "morphologies": ["8240", "8241", "8242", "8243", "8244", "8245", "8246", "8248", "8249"]},  # Carcinoid tumours
            {"sites": ["C06.9", "C07", "C08", "C21", "C22", "C23", "C24", "C25", "C26.8", "C26.9", "C50", "C61"], 
             "morphologies": ["8500", "8503", "8504", "8514", "8525"]},  # Ductal and lobular tumours
            {"sites": ["C38", "C39.8", "C39.9", "C47", "C48", "C49", "C67", "C68", "C71", "C72", "C73", "C74", "C75", "C76", "C80"], 
             "morphologies": ["8680", "8681", "8682", "8693", "8710", "8711", "8712", "8713"]},  # Paragangliomas
            {"sites": ["C40", "C41", "C42", "C43", "C44", "C45", "C46", "C47", "C48", "C49"], 
             "morphologies": ["8810", "8811", "8813", "8814", "8820", "8821", "8822", "8823", "8824", "8825", 
                              "8826", "8830", "8840", "8841", "8842", "8850", "8851", "8852", "8853", "8854", 
                              "8855", "8856", "8857", "8858", "8860", "8861", "8862", "8870", "8880", "8881", 
                              "8890", "8891", "8892", "8893", "8894", "8895", "8896", "8897", "8900", "8901", 
                              "8902", "8903", "8904", "8910", "8912", "8920", "8921", "8990", "8991", "9132"]},  # Nerve sheath tumours and others
            {"sites": ["C07", "C08", "C21", "C22", "C23", "C24", "C25", "C26", "C56", "C57", "C62", "C63", "C73", "C75", 
                      "C76.0", "C76.1", "C76.2", "C76.3", "C76.7", "C76.8", "C80"], 
             "morphologies": ["8080", "8081", "8090", "8091", "8092", "8093", "8094", "8095", "8096", "8097", "8100", 
                              "8101", "8102", "8103", "8110", "8390", "8391", "8392", "8400", "8401", "8402", 
                              "8403", "8404", "8405", "8406", "8407", "8408", "8409", "8410", "8413", "8420", 
                              "8542", "8790", "9700", "9709", "9718", "9734"]},  # Additional specific site-morphology combinations
            {"sites": ["C51", "C52", "C53", "C54", "C55", "C56", "C57", "C58", "C62", "C63.8", "C63.9", "C75.0", "C75.1", 
                      "C75.2", "C75.4", "C75.5", "C75.8", "C75.9"], 
             "morphologies": ["8590", "8591", "8592", "8630", "8631", "8633", "8634", "8640", "8642", "8650", "9054"]},  # Gonadal tumours
            {"sites": ["C40", "C41", "C42", "C43", "C44", "C45", "C46", "C47", "C48", "C49"], 
             "morphologies": ["8728", "9530", "9531", "9532", "9533", "9534", "9535", "9537", "9538", "9539"]},  # Meningeal tumours
            {"sites": ["C71.6", "C71.8", "C71.9", "C72.8", "C72.9"], 
             "morphologies": ["9470", "9471", "9472", "9474", "9480", "9493"]},  # Cerebellar tumours
            {"sites": ["C70", "C71", "C72", "C75.3"], 
             "morphologies": ["9381", "9390", "9444", "9380", "9382", "9383", "9384", "9391", "9392", "9393", 
                              "9394", "9400", "9401", "9410", "9411", "9412", "9413", "9420", "9421", "9423", 
                              "9424", "9430", "9440", "9441", "9442", "9450", "9451", "9460", "9473", "9505", 
                              "9506", "9508"]},  # Cerebral tumours, CNS tumours
            {"sites": ["C73"], "morphologies": ["8330", "8331", "8332", "8333", "8334", "8335", "8336", "8337", "8340", 
                                              "8341", "8342", "8343", "8344", "8345", "8346", "8347", "8350"]},  # Thyroid tumours
            {"sites": ["C74"], "morphologies": ["8370", "8371", "8372", "8373", "8374", "8375", "8700"]},  # Adrenal tumours
            {"sites": ["C75.0", "C75.1", "C75.2", "C75.4"], "morphologies": ["8321", "8322"]},  # Parathyroid tumours
            {"sites": ["C75.1", "C75.2"], "morphologies": ["8270", "8271", "8272", "8280", "8281", "8300", "9350", 
                                                          "9351", "9352", "9582"]},  # Pituitary tumours
            {"sites": ["C75.3"], "morphologies": ["9360", "9361", "9362"]},  # Pineal tumours
            {"sites": ["C75.5"], "morphologies": ["8690", "8691"]},  # Tumours of glomus jugulare / aortic body
            {"sites": ["C44", "C53", "C57.8", "C57.9"], "morphologies": ["8098"]},  # Adenoid basal carcinomas
            {"sites": ["C25", "C26", "C56", "C57", "C50", "C61"], 
             "morphologies": ["8450"]},  # Papillary (cyst)adenocarcinomas
            {"sites": ["C48", "C56"], "morphologies": ["8461"]},  # Serous surface papillary carcinomas
            {"sites": ["C56", "C57.8", "C57.9", "C62", "C63.8", "C63.9", "C75.8", "C75.9"], 
             "morphologies": ["8590", "8591", "8592", "8630", "8631", "8633", "8634", "8640", "8642", "8650", 
                              "9054"]},  # Additional Gonadal tumours
            {"sites": ["C56", "C57.8", "C57.9", "C62", "C63.8", "C63.9", "C75.8", "C75.9"], 
             "morphologies": ["8935", "9040", "9041", "9042", "9043", "9044", "9251", "9252", "9260", "9220", 
                              "9221", "9230", "9231", "9240", "9241", "9242", "9243", "8077", "8148", "8120", 
                              "8121", "8122", "8130", "8131", "8240", "8241", "8242", "8243", "8244", "8245", 
                              "8246", "8248", "8249", "8500", "8503", "8504", "8514", "8525", "8680", "8681", 
                              "8682", "8693", "8710", "8711", "8712", "8713"]},  # Consolidated multiple groups
            {"sites": ["C76.0", "C76.1", "C76.2", "C76.3", "C76.7", "C76.8", "C80"], 
             "morphologies": ["9100", "9101", "9102", "9103", "9104", "9105", "9370", "9371", "9372", "9373", 
                              "9490", "9491", "9492", "9500", "9501", "9502", "9503", "9504", "8728", "9530", 
                              "9531", "9532", "9533", "9534", "9535", "9537", "9538", "9539", "9470", "9471", 
                              "9472", "9474", "9480", "9493", "9381", "9390", "9444", "9380", "9382", "9383", 
                              "9384", "9391", "9392", "9393", "9394", "9400", "9401", "9410", "9411", "9412", 
                              "9413", "9420", "9421", "9423", "9424", "9430", "9440", "9441", "9442", "9450", 
                              "9451", "9460", "9473", "9505", "9506", "9508", "8330", "8331", "8332", "8333", 
                              "8334", "8335", "8336", "8337", "8340", "8341", "8342", "8343", "8344", "8345", 
                              "8346", "8347", "8350", "8370", "8371", "8372", "8373", "8374", "8375", "8700", 
                              "8321", "8322", "8270", "8271", "8272", "8280", "8281", "8300", "9350", "9351", 
                              "9352", "9582", "9360", "9361", "9362", "8690", "8691", "8692", "8730", "8743", 
                              "8550", "8551", "8552", "8560", "8561", "8562", "8570", "8571", "8572", "8573", 
                              "8574", "8575", "8576", "8932", "8933", "8934", "8950", "8951", "8960", "8964", 
                              "8965", "8966", "8967", "8980", "8981", "8982", "8802", "8810", "8811", "8813", 
                              "8814", "8815", "8820", "8821", "8822", "8823", "8824", "8825", "8826", "8830", 
                              "8840", "8841", "8842", "8850", "8851", "8852", "8853", "8854", "8855", "8856", 
                              "8857", "8858", "8860", "8861", "8862", "8870", "8880", "8881", "8890", "8891", 
                              "8892", "8893", "8894", "8895", "8896", "8897", "8900", "8901", "8902", "8903", 
                              "8904", "8910", "8912", "8920", "8921", "8990", "8991", "9132", "9540", "9541", 
                              "9550", "9560", "9561", "9562", "9570", "9571"]},  # Consolidated multiple groups
        ]

        total_records = len(dataset)
        for index, record in enumerate(dataset, start=1):
            logging.info(f"Validating site-morphology for record {index}/{total_records}")
            record.setdefault("is_valid", True)
            record.setdefault("validation_results", [])

            def log_site_morphology_error(field, message):
                record["is_valid"] = False
                record["validation_results"].append(f"{field}: {message}")

            site = record.get("topography")
            histology = normalize_histology_code(record.get("histology"))

            # Iterate through all checks
            for check in site_morphology_checks:
                if site in check["sites"]:
                    if histology not in check["morphologies"]:
                        log_site_morphology_error("site-morphology", f"Histology {histology} is not valid for site {site}")
                    else:
                        record["validation_results"].append(f"Valid diagnostic group: {site}, {histology}")
            
            if record["validation_results"]:
                results.append(record)

        logging.info("Completed site-morphology validations.")
        return results

    except Exception as e:
        logging.error(f"Error in run_site_morphology_edits: {str(e)}", exc_info=True)
        raise


def run_all_validations(dataset, validation_id):
    """
    Runs all validations sequentially and returns the combined results.
    """
    try:
        logging.info("Starting all validations.")
        send_progress(validation_id, "Running validations...", msg_type='info')
        
        # Example: Total number of validation steps
        total_steps = 3
        current_step = 1

        # 1. Individual item edits
        # **Step 1: Run Individual Item Validations**
        send_progress(validation_id, "Running individual item validations...", msg_type='info')
        individual_item_results = run_validations(dataset)
        send_progress(validation_id, f"Completed individual item edits ({current_step}/{total_steps}).", msg_type='success')
        current_step += 1

        # **Step 2: Run Data Combination Validations**
        send_progress(validation_id, "Running data combination validations...", msg_type='info')
        data_combination_results = run_data_combination_edits(individual_item_results)
        send_progress(validation_id, f"Completed data combination edits ({current_step}/{total_steps}).", msg_type='success')
        current_step += 1

        # **Step 3: Run Site-Morphology Validations**
        send_progress(validation_id, "Running site-morphology validations...", msg_type='info')
        final_results = run_site_morphology_edits(data_combination_results)
        send_progress(validation_id, f"Completed site-morphology edits ({current_step}/{total_steps}).", msg_type='success')
        
        results = final_results
        

        logging.info("Completed all validations.")
        return validation_id, results

    except Exception as e:
        logging.error(f"Error in run_all_validations: {str(e)}", exc_info=True)
        send_progress(validation_id, f"Validation failed: {str(e)}", msg_type='error')
        raise

def send_progress(validation_id, message, msg_type='info'):
    """
    Sends a progress message to the WebSocket group associated with the validation_id.

    Args:
        validation_id (str): The unique identifier for the validation task.
        message (str): The progress message to send.
        msg_type (str): Type of message ('info', 'success', 'error').
    """
    channel_layer = get_channel_layer()
    group_name = f'validation_{validation_id}'

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'validation_message',
            'message': json.dumps({  # Ensure the message is JSON-formatted as needed
                'type': msg_type,
                'message': message
            })
        }
    )