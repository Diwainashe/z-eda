// Eda.js

import withAuth from "./hoc/withAuth";
import {
	FormControl,
	InputLabel,
	Alert,
	Select,
	Stepper,
	MenuItem,
	Step,
	StepLabel,
	Button,
	Snackbar,
	Typography,
	TextField,
	CircularProgress,
	Card,
	CardContent,
	Grid,
	Box,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import React, { useState, useEffect, useRef } from "react";
import Papa from "papaparse"; // For CSV parsing
import { apiRequest } from "./utils/api"; // API Request Utility
import ExcelJS from "exceljs"; // For Excel export
import { parse, format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { styled } from "@mui/material/styles";

const steps = [
	"Upload Raw Data",
	"Inspect Data Schema",
	"Remove Duplicates",
	"Auto-Correct Codes",
	"Validate Data Integrity",
	"Stratify Data",
	"Consolidate Data",
	"Review & Finalize",
];

const requiredColumns = [
	"registration_number",
	"sex",
	"birth_date",
	"date_of_incidence",
	"topography",
	"histology",
	"behavior",
	"grade_code",
	"basis_of_diagnosis",
];

// StyledSection replaces the 'section' class
const StyledSection = styled("div")(({ theme }) => ({
	marginTop: theme.spacing(4),
}));

// Define StyledDataGrid using the styled API
const StyledDataGrid = styled(DataGrid)(({ theme }) => ({
	backgroundColor: "#fff",
	// Add more styles specific to DataGrid if necessary
	// For example, customizing the header:
	"& .MuiDataGrid-columnHeaders": {
		backgroundColor: theme.palette.primary.main,
		color: theme.palette.common.white,
	},
	// Customize row hover effect:
	"& .MuiDataGrid-row:hover": {
		backgroundColor: theme.palette.action.hover,
	},
}));

const FinishButton = styled(Button)({
	marginTop: "30px",
});

function Eda() {
	// State variables
	const [activeStep, setActiveStep] = useState(0);
	const [file, setFile] = useState(null);
	const [fileData, setFileData] = useState(null);
	const [fullData, setFullData] = useState(null); // Store full dataset
	const [progressMessage, setProgressMessage] = useState("");
	const [duplicateRows, setDuplicateRows] = useState([]);
	const [loading, setLoading] = useState(false); // Loader state
	const [duplicatesRemoved, setDuplicatesRemoved] = useState(false);
	const [missingColumns, setMissingColumns] = useState([]); // Missing columns
	const [columnMapping, setColumnMapping] = useState({}); // Mapping of missing to available columns
	const [correctedData, setCorrectedData] = useState([]); // Corrected data after auto-correction
	const [isLoading, setIsLoading] = useState(false); // Loading state for auto-correction
	const [corrections, setCorrections] = useState({
		topography: [],
		histology: [],
	});
	const [isAutoCorrectionDone, setIsAutoCorrectionDone] = useState(false);
	const [isValidationLoading, setIsValidationLoading] = useState(false);
	const [validationResults, setValidationResults] = useState([]);
	const [validationLogs, setValidationLogs] = useState([]); // Detailed validation logs
	const [openSnackbar, setOpenSnackbar] = useState(false);
	const [snackbarMessage, setSnackbarMessage] = useState("");
	const [snackbarSeverity, setSnackbarSeverity] = useState("success");
	const [error, setError] = useState(null);
	const [validationId, setValidationId] = useState(null); // Track the validation ID for WebSocket
	const [isValidationCompleted, setIsValidationCompleted] = useState(false); // Flag for validation completion
	const [warnings, setWarnings] = useState([]);
	const [stratificationStatus, setStratificationStatus] = useState(null);
	const [validationRows, setValidationRows] = useState([]);
	const [validEntries, setValidEntries] = useState([]);
	const [stratifiedData, setStratifiedData] = useState(null);
	const [isConsolidationSuccessful, setIsConsolidationSuccessful] =
		useState(false);

	const [isConsolidating, setIsConsolidating] = useState(false);

	const [cleanedData, setCleanedData] = useState(null);

	const [consolidationStatus, setConsolidationStatus] = useState("");
	const ws = useRef(null); // WebSocket reference
	const [uploadId, setUploadId] = useState(null);

	const [correctionRows, setCorrectionRows] = useState([]);
	const [correctionColumns, setCorrectionColumns] = useState([]);
	const [validatedRows, setValidatedRows] = useState([]);
	const [validatedColumns, setValidatedColumns] = useState([]);
	const [correctionError, setCorrectionError] = useState(null); // Changed
	const [validationError, setValidationError] = useState(null); // Changed
	// Initialize columns and rows states
	const [columns, setColumns] = useState([]);
	const [rows, setRows] = useState([]);

	// Initialize states for columns
	const [validationColumns, setValidationColumns] = useState([
		{
			field: "registration_number",
			headerName: "Registration Number",
			width: 150,
		},
		{ field: "topography", headerName: "Topography", width: 150 },
		{ field: "date_of_incidence", headerName: "Date of Incidence", width: 180 },
		{ field: "histology", headerName: "Histology/Morphology", width: 180 },
		{
			field: "is_valid",
			headerName: "Valid",
			width: 100,
			renderCell: (params) => (params.value ? "Yes" : "No"),
		},
	]);

	const [validColumns] = useState([
		{
			field: "registration_number",
			headerName: "Registration Number",
			width: 150,
		},
		{ field: "sex", headerName: "Sex", width: 100 },
		{ field: "birth_date", headerName: "Birth Date", width: 150 },
		{ field: "date_of_incidence", headerName: "Date of Incidence", width: 150 },
		{ field: "topography", headerName: "Topography", width: 150 },
		{ field: "histology", headerName: "Histology", width: 150 },
		{ field: "behavior", headerName: "Behavior", width: 100 },
		{ field: "grade_code", headerName: "Grade Code", width: 150 },
		{
			field: "basis_of_diagnosis",
			headerName: "Basis of Diagnosis",
			width: 200,
		},
	]);

	// Function to handle data stratification
	// Enhanced stratification function
	const stratifyData = () => {
		const stratified = {
			ageGroups: {
				"0-18": [],
				"19-35": [],
				"36-55": [],
				"56+": [],
			},
			gender: {
				male: [],
				female: [],
			},
			topography: {},
			histology: {},
			behavior: {
				benign: [],
				malignant: [],
				uncertain: [],
				unspecified: [],
			},
			grade: {
				1: [],
				2: [],
				3: [],
				4: [],
			},
			basisOfDiagnosis: {},
		};

		validEntries.forEach((entry) => {
			const age = entry.age_at_incidence;
			const sex = entry.sex;
			const topography = entry.topography;
			const histology = entry.histology;
			const behavior = entry.behavior;
			const grade = entry.grade_code;
			const basisOfDiagnosis = entry.basis_of_diagnosis;

			// Age group stratification
			if (age <= 18) stratified.ageGroups["0-18"].push(entry);
			else if (age <= 35) stratified.ageGroups["19-35"].push(entry);
			else if (age <= 55) stratified.ageGroups["36-55"].push(entry);
			else stratified.ageGroups["56+"].push(entry);

			// Gender stratification
			if (sex === "1") stratified.gender.male.push(entry);
			else if (sex === "2") stratified.gender.female.push(entry);

			// Topography stratification
			if (!stratified.topography[topography])
				stratified.topography[topography] = [];
			stratified.topography[topography].push(entry);

			// Histology stratification
			if (!stratified.histology[histology])
				stratified.histology[histology] = [];
			stratified.histology[histology].push(entry);

			// Behavior code stratification
			switch (behavior) {
				case "1":
					stratified.behavior.benign.push(entry);
					break;
				case "3":
					stratified.behavior.malignant.push(entry);
					break;
				case "2":
					stratified.behavior.uncertain.push(entry);
					break;
				case "0":
				default:
					stratified.behavior.unspecified.push(entry);
					break;
			}

			// Grade code stratification
			if (grade && stratified.grade[grade]) {
				stratified.grade[grade].push(entry);
			}

			// Basis of Diagnosis stratification
			if (!stratified.basisOfDiagnosis[basisOfDiagnosis]) {
				stratified.basisOfDiagnosis[basisOfDiagnosis] = [];
			}
			stratified.basisOfDiagnosis[basisOfDiagnosis].push(entry);
		});

		setStratifiedData(stratified); // Store stratified data in state
	};

	useEffect(() => {
		// Generate a unique uploadId when the component mounts
		setUploadId(uuidv4());
	}, []);

	// Stepper Navigation Handlers
	const handleNext = () => {
		setActiveStep((prevActiveStep) => prevActiveStep + 1);
		setProgressMessage("");
	};

	const handleBack = () => {
		setActiveStep((prevActiveStep) => prevActiveStep - 1);
		setProgressMessage("");
	};

	// Function to clean up file data by removing empty columns
	const cleanFileData = (data) => {
		return data.map((row) => {
			const cleanedRow = {};
			Object.keys(row).forEach((key) => {
				// Only keep non-empty and valid keys
				if (
					key.trim() &&
					row[key] !== undefined &&
					row[key] !== null &&
					row[key] !== ""
				) {
					cleanedRow[key] = row[key];
				}
			});
			return cleanedRow;
		});
	};

	// Function to parse and clean CSV data
	const parseAndCleanCSV = (rawData) => {
		// Parse CSV data
		const parsedData = Papa.parse(rawData, {
			header: true,
			skipEmptyLines: true,
		}).data;

		// Clean up the parsed data
		return cleanFileData(parsedData);
	};

	// Function to parse and clean Excel data
	const parseAndCleanExcel = async (rawData) => {
		try {
			const workbook = new ExcelJS.Workbook();
			await workbook.xlsx.load(rawData); // Load binary data into workbook

			const worksheet = workbook.getWorksheet(1); // Get the first sheet by index (1-based)
			const parsedData = [];

			// Iterate through each row in the worksheet and convert to JSON-like format
			worksheet.eachRow((row, rowNumber) => {
				const rowData = row.values.slice(1); // Skip the first index, as it’s often metadata
				parsedData.push(rowData);
			});

			return cleanFileData(parsedData);
		} catch (error) {
			console.error("ExcelJS parsing error:", error);
			setProgressMessage("Failed to parse Excel file.");
			return null;
		}
	};

	const handleFileChange = (event) => {
		const selectedFile = event.target.files[0];
		if (selectedFile) {
			const fileFormat = selectedFile.name.split(".").pop().toLowerCase();
			const reader = new FileReader();

			reader.onload = (e) => {
				let parsedData;
				const rawData = e.target.result;

				try {
					// Parse file based on format
					switch (fileFormat) {
						case "csv":
							parsedData = parseAndCleanCSV(rawData);
							break;
						case "json":
							parsedData = JSON.parse(rawData);
							parsedData = cleanFileData(parsedData);
							break;
						case "xlsx":
							parsedData = parseAndCleanExcel(rawData);
							break;
						default:
							throw new Error("Unsupported file format");
					}

					// Set parsed data to fileData regardless of validation
					setFileData(parsedData);

					// Validate data, setting missing columns or errors if any
					if (validateData(parsedData)) {
						setProgressMessage("File parsed and cleaned successfully.");
					} else {
						setProgressMessage(
							"Data validation failed. Some columns may be missing. Proceed to mapping in step 2."
						);
					}
				} catch (error) {
					console.error("Error parsing file:", error);
					setProgressMessage(
						`Error: Unable to parse ${fileFormat.toUpperCase()} file.`
					);
				}
			};

			// Read the file based on format
			if (fileFormat === "xlsx" || fileFormat === "xls") {
				reader.readAsArrayBuffer(selectedFile); // Use ArrayBuffer for Excel files
			} else if (fileFormat === "csv" || fileFormat === "json") {
				reader.readAsText(selectedFile);
			} else {
				setProgressMessage("Unsupported file format.");
				setPreviewData(null);
			}

			setFile(selectedFile);
		}
	};

	// Function to handle file submission (validation and server-side processing)
	const handleFileSubmit = async () => {
		if (!file) {
			setProgressMessage("No file selected. Please select a file to upload.");
			return;
		}

		setIsLoading(true);
		setProgressMessage("");

		try {
			// At this point, fullData is already set from handleFileChange
			// You can perform further processing here, such as consolidating data

			// For demonstration, let's assume consolidation is setting fullData
			if (validateData(fileData)) {
				setFullData(fileData);
				setProgressMessage("File data set successfully.");
			} else {
				setFullData([]); // Clear full data if validation fails
				// setProgressMessage is already set in validateData
			}
		} catch (error) {
			console.error("Data processing error:", error);
			setProgressMessage("Error: Unable to process the data.");
			setError("Error: Unable to process the data.");
			setOpenSnackbar(true);
		} finally {
			setIsLoading(false);
		}
	};

	// CSV Data Validation on Frontend
	const validateData = (data) => {
		if (!data || data.length === 0) {
			setMissingColumns(requiredColumns);
			return false;
		}

		const uploadedColumns = Object.keys(data[0]);
		const missingCols = requiredColumns.filter(
			(col) => !uploadedColumns.includes(col)
		);

		setMissingColumns(missingCols);

		if (missingCols.length > 0) {
			setProgressMessage(`Missing required columns: ${missingCols.join(", ")}`);
			return false;
		}
		return true;
	};

	// Validate the schema after data is uploaded
	useEffect(() => {
		if (fileData) {
			if (!validateData(fileData)) {
				setProgressMessage(
					"Data validation failed. Please check the required columns."
				);
			}
		}
	}, [fileData]);

	// Step 3: Remove Duplicates (retain the earliest 'date_of_incidence')
	// Function to remove duplicates based on registration_number and retain earliest date_of_incidence
	const handleRemoveDuplicates = () => {
		if (!fullData || fullData.length === 0) {
			setProgressMessage("No data available to check for duplicates.");
			return;
		}

		// Initialize a map to store the earliest entry for each registration_number
		const regNumberMap = {};

		fullData.forEach((row) => {
			// Normalize the registration_number by trimming whitespace
			const regNumber = row.registration_number.trim();
			const incidenceDate = new Date(row.date_of_incidence);

			// Check if the registration_number already exists in the map
			if (regNumberMap[regNumber]) {
				const existingDate = new Date(
					regNumberMap[regNumber].date_of_incidence
				);

				// If the current row has an earlier date, update the map
				if (incidenceDate < existingDate) {
					regNumberMap[regNumber] = row;
				}
			} else {
				// If registration_number is not in the map, add it
				regNumberMap[regNumber] = row;
			}
		});

		// Convert the map back to an array of cleaned data
		const cleanedData = Object.values(regNumberMap);

		// Update state based on whether duplicates were found and removed
		if (cleanedData.length === fullData.length) {
			setProgressMessage("No duplicates found.");
		} else {
			setFileData(cleanedData); // Use cleaned data for display
			setFullData(cleanedData); // Update fullData to persist changes
			setDuplicateRows([]); // Clear any tracked duplicate rows
			setProgressMessage("Duplicates removed successfully.");
			setDuplicatesRemoved(true);
		}

		// Debugging log to verify cleaned data
		console.log("Cleaned Data (No Duplicates):", cleanedData);
	};

	// Function to handle the auto-correction API call
	const handleAutoCorrect = async () => {
		if (!validateDataset(fileData)) {
			setProgressMessage(
				"Error: Invalid dataset structure. Please check the data."
			);
			console.error("Dataset is invalid.");
			setError("Error: Invalid dataset structure.");
			setValidationError("Invalid dataset structure."); // Added: Set validationError
			setOpenSnackbar(true);
			return;
		}

		setIsLoading(true);
		setProgressMessage("");
		setCorrectionError(null); // Added: Reset correctionError

		try {
			// Trigger the auto-correction API call
			const response = await apiRequest("auto-correct-codes/", "POST", {
				dataset: fileData,
			});

			const { upload_id, corrected_data, corrections } = response;

			// Set validationId to establish WebSocket connection
			setValidationId(upload_id);

			// Set the corrected data
			setCorrectedData(corrected_data);

			// Set the corrections data
			setCorrections(corrections);

			// Define rows for DataGrid
			const newCorrectionRows = [
				...corrections.topography.map((row, index) => ({
					id: index,
					original_value: row.original_value,
					corrected_value: row.corrected_value,
					confidence: row.confidence,
					correction_type: "Topography",
				})),
				...corrections.histology.map((row, index) => ({
					id: corrections.topography.length + index,
					original_value: row.original_value,
					corrected_value: row.corrected_value,
					confidence: row.confidence,
					correction_type: "Histology",
				})),
				...corrections.sex.map((row, index) => ({
					id:
						corrections.topography.length +
						corrections.histology.length +
						index,
					original_value: row.original_value,
					corrected_value: row.corrected_value,
					confidence: row.confidence,
					correction_type: "Sex",
				})),
			];

			// Define columns for DataGrid
			const newCorrectionColumns = [
				{ field: "id", headerName: "ID", width: 100 },
				{ field: "correction_type", headerName: "Correction Type", width: 150 },
				{ field: "original_value", headerName: "Original Value", width: 200 },
				{ field: "corrected_value", headerName: "Corrected Value", width: 200 },
				{ field: "confidence", headerName: "Confidence", width: 150 },
			];

			// Update state with rows and columns
			setCorrectionRows(newCorrectionRows);
			setCorrectionColumns(newCorrectionColumns);

			// Set the completion and message states
			setIsAutoCorrectionDone(true);
			setProgressMessage("Auto-correction completed successfully.");
		} catch (error) {
			console.error("Error during auto-correction:", error);
			setProgressMessage("Error during auto-correction.");
			setError("Error during auto-correction.");
			setCorrectionError("An error occurred during auto-correction."); // Added: Set correctionError
			setOpenSnackbar(true);
		} finally {
			setIsLoading(false);
		}
	};

	// Helper function to validate the dataset before sending
	const validateDataset = (dataset) => {
		try {
			JSON.stringify(dataset);
			return true;
		} catch (error) {
			console.error("Invalid dataset:", error);
			return false;
		}
	};

	// Function to clean each row and remove empty columns
	const cleanRow = (row) => {
		const cleanedRow = {};
		Object.keys(row).forEach((key) => {
			// Only keep non-empty keys
			if (
				key.trim() &&
				row[key] !== undefined &&
				row[key] !== null &&
				row[key] !== ""
			) {
				cleanedRow[key] = row[key];
			}
		});
		return cleanedRow;
	};

	// Function to check for duplicates
	const checkForDuplicates = () => {
		if (!fullData) {
			setProgressMessage("Error: No dataset available for duplicate check.");
			return;
		}

		// Clean the dataset before checking for duplicates
		const cleanedData = fullData.map(cleanRow);

		// Find exact duplicates (identical rows)
		const exactDuplicates = cleanedData.filter(
			(row, index, self) =>
				self.findIndex((r) => JSON.stringify(r) === JSON.stringify(row)) !==
				index
		);

		// Handle duplicates based on 'registration_number', keeping the one with the earliest 'date_of_incidence'
		const seenRegistrationNumbers = {};
		const duplicateRegistrationNumbers = [];

		cleanedData.forEach((row, index) => {
			const regNumber = row.registration_number;
			const incidenceDate = new Date(row.date_of_incidence);

			if (seenRegistrationNumbers[regNumber]) {
				// If already seen, compare dates and update if the current row is older
				const existingRowIndex = seenRegistrationNumbers[regNumber].index;
				const existingDate = new Date(
					seenRegistrationNumbers[regNumber].date_of_incidence
				);

				if (incidenceDate < existingDate) {
					// Replace with the current row if it has an earlier 'date_of_incidence'
					duplicateRegistrationNumbers.push(fullData[existingRowIndex]);
					seenRegistrationNumbers[regNumber] = {
						index,
						date_of_incidence: row.date_of_incidence,
					};
				} else {
					// Otherwise, mark the current row as a duplicate
					duplicateRegistrationNumbers.push(row);
				}
			} else {
				// If not seen, add to seen registration numbers
				seenRegistrationNumbers[regNumber] = {
					index,
					date_of_incidence: row.date_of_incidence,
				};
			}
		});

		// Merge both types of duplicates (exact duplicates + registration_number duplicates)
		const duplicates = [...exactDuplicates, ...duplicateRegistrationNumbers];

		// Log duplicates to see if extra columns are present
		console.log("Duplicates after cleaning:", duplicates);

		setDuplicateRows(duplicates); // Set duplicates for visualization

		if (duplicates.length === 0) {
			setProgressMessage("No duplicates found in the dataset.");
		} else {
			setProgressMessage("Duplicates found. Ready for removal.");
		}
	};

	// useEffect to check for duplicates when the user enters Step 3
	useEffect(() => {
		if (activeStep === 2) {
			checkForDuplicates(); // Check for duplicates when the user reaches Step 3
		}
	}, [activeStep]); // This will run whenever activeStep changes

	// useEffect for logging purposes (optional)
	useEffect(() => {
		if (validationId) {
			console.log("Validation ID:", validationId);
		}
		if (fileData) {
			console.log("File Data:", fileData);
		}
		if (duplicateRows.length > 0) {
			console.log("Duplicate Rows:", duplicateRows);
		}
	}, [validationId, fileData, duplicateRows]);

	// Function to handle column mapping changes
	const handleColumnMappingChange = (event, missingColumn) => {
		setColumnMapping({
			...columnMapping,
			[missingColumn]: event.target.value,
		});
	};

	// Apply column mapping and rename columns in fileData
	const applyColumnMapping = () => {
		const newFileData = fileData.map((row) => {
			const updatedRow = { ...row };
			missingColumns.forEach((missingColumn) => {
				if (columnMapping[missingColumn]) {
					updatedRow[missingColumn] = updatedRow[columnMapping[missingColumn]];
					delete updatedRow[columnMapping[missingColumn]]; // Remove the old column
				}
			});
			return updatedRow;
		});
		setFileData(newFileData);
		setMissingColumns([]); // Clear missing columns after mapping
		setProgressMessage("Column mapping applied successfully.");
	};

	// Function to handle running all validations and displaying results
	const handleRunAllValidations = async () => {
		setIsValidationLoading(true);
		setProgressMessage("");
		setValidationLogs([]);
		setValidationResults([]);
		setError(null);
		setOpenSnackbar(false);
		setValidationError(null); // Added: Reset validationError

		try {
			const response = await apiRequest("run-all-validations/", "POST", {
				dataset: correctedData,
			});

			const { validation_id, validation_results, valid_entries } = response;
			setValidationId(validation_id);

			// Remove duplicates for valid_entries
			const uniqueValidEntries = Array.from(
				new Set(valid_entries.map((entry) => entry.registration_number))
			).map((regNumber) =>
				valid_entries.find((entry) => entry.registration_number === regNumber)
			);

			setValidationResults(validation_results);
			setValidEntries(uniqueValidEntries);

			// Define rows and columns for the validation results DataGrid
			const newValidationRows = validation_results.map((entry, index) => ({
				id: index,
				registration_number: entry.registration_number,
				reason: entry.reason,
			}));

			const newValidationColumns = [
				{ field: "id", headerName: "ID", width: 100 },
				{
					field: "registration_number",
					headerName: "Registration Number",
					width: 200,
				},
				{
					field: "reason",
					headerName: "Reason for Validation Failure",
					width: 400,
				},
			];

			setValidatedRows(newValidationRows);
			setValidatedColumns(newValidationColumns);

			setProgressMessage("Validations completed successfully.");
			setIsValidationCompleted(true);
		} catch (err) {
			console.error("Error initiating validations:", err);
			setError(err.message || "Failed to initiate validations.");
			setValidationError("An error occurred during validations."); // Added: Set validationError
			setOpenSnackbar(true);
		} finally {
			setIsValidationLoading(false);
		}
	};

	const handleCloseSnackbar = (event, reason) => {
		if (reason === "clickaway") {
			return;
		}
		setOpenSnackbar(false);
	};

	useEffect(() => {
		console.log("Validation and Columns Data Loaded:", {
			validationRows,
			validEntries,
			validationColumns,
		});
	}, [validationRows, validEntries]);

	// Function to download validation logs as a report (Optional)
	const downloadReport = () => {
		const element = document.createElement("a");
		const file = new Blob(
			validationLogs
				.map((log) => `[${new Date().toISOString()}] ${log.message}`)
				.join("\n"),
			{ type: "text/plain" }
		);
		element.href = URL.createObjectURL(file);
		element.download = "validation_report.txt";
		document.body.appendChild(element); // Required for Firefox
		element.click();
	};

	// Update columns and rows whenever fileData changes
	useEffect(() => {
		if (Array.isArray(fileData) && fileData.length > 0) {
			const newColumns = Object.keys(fileData[0]).map((key) => ({
				field: key,
				headerName: key.charAt(0).toUpperCase() + key.slice(1),
				flex: 1,
				minWidth: 150,
			}));
			const newRows = fileData.map((row, index) => ({
				id: index,
				...row,
			}));

			setColumns(newColumns); // Set columns in state
			setRows(newRows); // Set rows in state
		} else {
			setColumns([]); // Clear columns if no data
			setRows([]); // Clear rows if no data
		}
	}, [fileData]);

	const formatDate = (dateString) => {
		const parsedDate = parse(dateString, "dd/MM/yyyy", new Date());
		if (isNaN(parsedDate)) {
			// Handle invalid date
			console.error(`Invalid date: ${dateString}`);
			return null; // Or handle as needed
		}
		return format(parsedDate, "yyyy-MM-dd");
	};

	const resetAll = () => {
		setActiveStep(0);
		setCorrections({
			topography: [],
			histology: [],
			sex: [],
		});
		setValidationResults([]);
		setCorrectedData([]);
		setFileData([]);
		setProgressMessage("");
	};

	// Function to call the consolidation API
	const consolidateData = async () => {
		try {
			if (!uploadId) {
				console.error("uploadId is not defined");
				return;
			}

			// Format the valid entries
			const formattedValidEntries = validEntries
				.map((entry) => {
					const birthDate = formatDate(entry.birth_date);
					const incidenceDate = formatDate(entry.date_of_incidence);

					if (!birthDate || !incidenceDate) {
						console.error(
							`Invalid date in entry: ${entry.registration_number}`
						);
						return null;
					}

					return {
						...entry,
						birth_date: birthDate,
						date_of_incidence: incidenceDate,
					};
				})
				.filter((entry) => entry !== null);

			console.log("uploadId:", uploadId);
			console.log("formattedValidEntries:", formattedValidEntries);

			const response = await apiRequest("consolidate/", "POST", {
				upload_id: uploadId,
				valid_entries: formattedValidEntries,
				stratified_data: stratifiedData,
			});

			// Assuming response is the JSON data from the server
			console.log("Consolidation completed successfully:", response.message);
		} catch (error) {
			if (error.status === 400) {
				console.error("Failed to consolidate data:", error.message);
			} else {
				console.error("Error consolidating data:", error);
			}
		}
	};

	return (
		<div>
			<Stepper activeStep={activeStep} alternativeLabel>
				{steps.map((label) => (
					<Step key={label}>
						<StepLabel>{label}</StepLabel>
					</Step>
				))}
			</Stepper>

			{/* Display loading indicator */}
			{loading && (
				<div style={{ marginTop: "20px", textAlign: "center" }}>
					<CircularProgress />
					<Typography variant="body1">Processing...</Typography>
				</div>
			)}

			{/* Final Step Completion */}
			{!loading && activeStep === steps.length && (
				<Typography variant="h6" style={{ marginTop: "20px" }}>
					Data Processing Complete!
				</Typography>
			)}

			{/* Main Content */}
			{!loading && activeStep < steps.length && (
				<div style={{ marginTop: "20px" }}>
					{/* Step 1: Upload */}
					{activeStep === 0 && (
						<div>
							<Typography variant="h6">
								Upload your data file (CSV, XLSX, JSON)
							</Typography>
							<TextField
								type="file"
								inputProps={{ accept: ".csv, .xls, .xlsx, .json" }}
								onChange={handleFileChange}
								style={{ marginTop: "10px" }}
							/>

							<Button
								variant="contained"
								onClick={handleFileSubmit}
								disabled={!file || isLoading}
								style={{ marginTop: "10px", marginLeft: "10px" }}
							>
								Upload
							</Button>

							{/* Display loading indicator during upload */}
							{isLoading && (
								<div style={{ marginTop: "20px" }}>
									<CircularProgress />
									<Typography variant="body1">
										Uploading and validating file...
									</Typography>
								</div>
							)}

							{/* Display progress message */}
							{progressMessage && (
								<Typography variant="body1" style={{ marginTop: "10px" }}>
									{progressMessage}
								</Typography>
							)}
						</div>
					)}
					{/* // In your Step 2: Data Schema Inspection */}
					{activeStep === 1 && fileData && (
						<div>
							<Typography variant="h6">Data Preview</Typography>
							<div
								style={{
									height: 500,
									width: "100%",
									display: "flex",
									flexDirection: "column",
								}}
							>
								{/* // Use in DataGrid */}
								<DataGrid
									columns={columns}
									rows={rows}
									pageSize={10}
									rowsPerPageOptions={[10, 25, 50]}
									disableSelectionOnClick
									disableColumnMenu
									sx={{
										"& .MuiDataGrid-columnHeaders": {
											position: "sticky",
											top: 0,
											zIndex: 1,
											backgroundColor: "#f5f5f5",
										},
									}}
								/>
							</div>

							{/* Display missing columns if any */}
							{missingColumns.length > 0 && (
								<div style={{ marginTop: "10px" }}>
									<Typography style={{ color: "red" }}>
										Missing required columns: {missingColumns.join(", ")}
									</Typography>

									{/* Dropdowns to map missing columns */}
									{missingColumns.map((missingColumn) => (
										<div key={missingColumn} style={{ marginBottom: "10px" }}>
											<FormControl fullWidth>
												<InputLabel>
													Select a column for {missingColumn}
												</InputLabel>
												<Select
													value={columnMapping[missingColumn] || ""}
													onChange={(event) =>
														handleColumnMappingChange(event, missingColumn)
													}
												>
													{Object.keys(fileData[0]).map((availableColumn) => (
														<MenuItem
															key={availableColumn}
															value={availableColumn}
														>
															{availableColumn}
														</MenuItem>
													))}
												</Select>
											</FormControl>
										</div>
									))}

									<Button
										variant="contained"
										onClick={applyColumnMapping}
										disabled={Object.keys(columnMapping).length === 0}
									>
										Apply Column Mapping
									</Button>
								</div>
							)}

							{/* Display progress message */}
							{progressMessage && (
								<Typography variant="body1" style={{ marginTop: "10px" }}>
									{progressMessage}
								</Typography>
							)}
						</div>
					)}
					{/* Step 3: Remove Duplicates */}
					{activeStep === 2 && (
						<div>
							<Typography variant="h6">Remove Duplicates</Typography>

							{/* Show duplicates if found */}
							{duplicateRows.length > 0 ? (
								<>
									<Typography variant="h6">Duplicates Found:</Typography>
									<div
										style={{ height: 400, width: "100%", marginTop: "10px" }}
									>
										<DataGrid
											rows={duplicateRows.map((row, index) => ({
												id: index,
												...row,
											}))}
											columns={columns}
											pageSize={10}
											disableSelectionOnClick
										/>
									</div>
								</>
							) : (
								<Typography variant="h6" style={{ color: "green" }}>
									No duplicates found in the dataset.
								</Typography>
							)}

							{/* Show updated data after duplicates have been removed */}
							{duplicatesRemoved && (
								<>
									<Typography variant="h6" style={{ marginTop: "20px" }}>
										Data After Duplicate Removal:
									</Typography>
									<div
										style={{ height: 750, width: "100%", marginTop: "20px" }}
									>
										<DataGrid
											rows={fileData.map((row, index) => ({
												id: index,
												...row,
											}))}
											columns={columns}
											pageSize={10}
											disableSelectionOnClick
										/>
									</div>
								</>
							)}

							{/* Button for removing duplicates */}
							<Button
								onClick={handleRemoveDuplicates}
								disabled={!duplicateRows || duplicateRows.length === 0}
								style={{ marginTop: "20px" }}
								variant="contained"
								color="secondary"
							>
								Remove Duplicates
							</Button>

							{/* Display progress message */}
							{progressMessage && (
								<Typography variant="body1" style={{ marginTop: "10px" }}>
									{progressMessage}
								</Typography>
							)}
						</div>
					)}
					{/* Step 4: Auto-Correct Codes */}
					{activeStep === 3 && (
						<div>
							<Typography variant="h6">Auto-Correct Codes</Typography>

							{/* Button to trigger the auto-correction process */}
							<Button
								onClick={handleAutoCorrect}
								style={{ marginTop: "20px" }}
								disabled={isLoading || fileData.length === 0} // Disable if loading or no data
								variant="contained"
								color="primary"
							>
								Run Auto-Correction
							</Button>

							{/* Display loading indicator while correction is processing */}
							{isLoading && (
								<Typography
									variant="body1"
									style={{ marginTop: "20px", color: "blue" }}
								>
									Auto-correcting codes, please wait...
								</Typography>
							)}

							{/* Display progress message */}
							{progressMessage && (
								<Typography variant="body1" style={{ marginTop: "10px" }}>
									{progressMessage}
								</Typography>
							)}

							{/* Show the table of corrected data after processing */}
							{!isLoading && correctedData.length > 0 && (
								<div>
									<Typography variant="h6" style={{ marginTop: "20px" }}>
										Corrected Data:
									</Typography>
									<div
										style={{ height: 400, width: "100%", marginTop: "10px" }}
									>
										<DataGrid
											rows={correctedData.map((row, index) => ({
												id: index,
												...row,
											}))}
											columns={columns}
											pageSize={10}
											disableSelectionOnClick
										/>
									</div>

									{/* Corrections Log */}
									{(corrections.topography.length > 0 ||
										corrections.histology.length > 0) && (
										<div>
											<Typography variant="h6" style={{ marginTop: "20px" }}>
												Corrections Log:
											</Typography>
											<div
												style={{
													height: 400,
													width: "100%",
													marginTop: "10px",
												}}
											>
												<DataGrid
													rows={[
														...corrections.topography.map((row, index) => ({
															id: index,
															original_value: row.original_value,
															corrected_value: row.corrected_value,
															confidence: row.confidence,
															correction_type: "Topography",
														})),
														...corrections.histology.map((row, index) => ({
															id: corrections.topography.length + index,
															original_value: row.original_value,
															corrected_value: row.corrected_value,
															confidence: row.confidence,
															correction_type: "Histology",
														})),
														...corrections.sex.map((row, index) => ({
															id: corrections.sex.length + index,
															original_value: row.original_value,
															corrected_value: row.corrected_value,
															confidence: row.confidence,
															correction_type: "Sex",
														})),
													]}
													columns={[
														{ field: "id", headerName: "ID", width: 100 },
														{
															field: "correction_type",
															headerName: "Correction Type",
															width: 150,
														},
														{
															field: "original_value",
															headerName: "Original Value",
															width: 200,
														},
														{
															field: "corrected_value",
															headerName: "Corrected Value",
															width: 200,
														},
														{
															field: "confidence",
															headerName: "Confidence",
															width: 150,
														},
													]}
													pageSize={10}
													disableSelectionOnClick
												/>
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					)}
					{/* Step 5: Validate Data Integrity */}
					{activeStep === 4 && (
						<div>
							<Typography variant="h6">Validate Data Integrity</Typography>
							{/* Button to trigger validations */}
							<Button
								onClick={handleRunAllValidations}
								style={{ marginTop: "20px" }}
								disabled={isValidationLoading || !isAutoCorrectionDone}
								variant="contained"
								color="secondary"
							>
								Run All Validations
							</Button>
							{/* Display loading indicator */}
							{isValidationLoading && (
								<Typography
									variant="body1"
									style={{ marginTop: "20px", color: "blue" }}
								>
									Running all validations, please wait...
								</Typography>
							)}
							{/* Display progress message */}
							{progressMessage && (
								<Typography variant="body1" style={{ marginTop: "10px" }}>
									{progressMessage}
								</Typography>
							)}
							{/* Show validation logs and results */}
							{/* {validationLogs.length > 0 && (
								<div>
									<Typography variant="h6" style={{ marginTop: "20px" }}>
										Validation Logs:
									</Typography>
									<List>
										{validationLogs.map((log, index) => (
											<ListItem key={index}>
												<ListItemIcon>
													{log.type === "success" ? (
														<CheckCircleIcon style={{ color: "green" }} />
													) : log.type === "error" ? (
														<ErrorIcon style={{ color: "red" }} />
													) : (
														<InfoIcon style={{ color: "blue" }} />
													)}
												</ListItemIcon>
												<ListItemText primary={log.message} />
											</ListItem>
										))}
									</List>
								</div>
							)} */}
							{/* Show validation results if completed */}
							{isValidationCompleted && (
								<div>
									<Typography variant="h6" style={{ marginTop: "20px" }}>
										Valid Records:
									</Typography>
									<div
										style={{ height: 600, width: "100%", marginTop: "10px" }}
									>
										<DataGrid
											rows={validEntries.map((entry, index) => ({
												id: index + 1, // Add unique id for each row
												...entry,
											}))}
											columns={Object.keys(validEntries[0])
												.filter(
													(key) =>
														key !== "is_valid" && key !== "validation_results"
												) // Exclude specific fields
												.map((key) => ({
													field: key,
													headerName: key.replace(/_/g, " ").toUpperCase(), // Format the header name
													flex: 1,
													minWidth: 150,
												}))}
											pageSize={10}
											disableSelectionOnClick
										/>
									</div>
									<Typography variant="h6" style={{ marginTop: "20px" }}>
										Validation Results:
									</Typography>
									<div
										style={{ height: 400, width: "100%", marginTop: "10px" }}
									>
										<DataGrid
											rows={validationResults}
											columns={validationColumns} // Define columns for displaying all results
											pageSize={5}
											disableSelectionOnClick
											getRowId={(row) => row.registration_number}
										/>
									</div>
								</div>
							)}
						</div>
					)}
					{/* Step 6: Data Stratification for Visualization */}
					{activeStep === 5 && (
						<div>
							<Typography variant="h6">
								Data Stratification for Visualization
							</Typography>

							<Typography variant="body1" style={{ marginTop: "10px" }}>
								Stratifying the data to prepare for visualization. This process
								categorizes data based on relevant dimensions such as age
								groups, sex, regions, cancer types, behavior, grade, and basis
								of diagnosis.
							</Typography>

							{/* Display stratification status */}
							{stratificationStatus && (
								<Box mt={2}>
									<Typography variant="subtitle1">
										Stratification Status:
									</Typography>
									<Typography
										variant="body2"
										style={{ whiteSpace: "pre-line" }}
									>
										{stratificationStatus}
									</Typography>
								</Box>
							)}

							{/* Display warnings if any */}
							{warnings.length > 0 && (
								<Box mt={2}>
									<Alert severity="warning">
										{warnings.map((warning, index) => (
											<div key={index}>{warning}</div>
										))}
									</Alert>
								</Box>
							)}

							{/* Loading Indicator */}
							{loading && (
								<Box mt={2}>
									<CircularProgress />
								</Box>
							)}

							{/* Action Buttons */}
							<Box mt={4}>
								<Button
									variant="contained"
									color="primary"
									onClick={stratifyData}
									disabled={loading}
								>
									Stratify Data
								</Button>
							</Box>
							{stratifiedData && (
								<div style={{ marginTop: "20px" }}>
									<Typography variant="h4" gutterBottom>
										Stratified Data Overview
									</Typography>

									<Grid container spacing={3}>
										{/* Age Groups */}
										<Grid item xs={12} sm={6} md={4}>
											<Card variant="outlined">
												<CardContent>
													<Typography variant="h6">Age Groups</Typography>
													<pre>
														{JSON.stringify(stratifiedData.ageGroups, null, 2)}
													</pre>
												</CardContent>
											</Card>
										</Grid>

										{/* Gender */}
										<Grid item xs={12} sm={6} md={4}>
											<Card variant="outlined">
												<CardContent>
													<Typography variant="h6">Gender</Typography>
													<pre>
														{JSON.stringify(stratifiedData.gender, null, 2)}
													</pre>
												</CardContent>
											</Card>
										</Grid>

										{/* Topography */}
										<Grid item xs={12} sm={6} md={4}>
											<Card variant="outlined">
												<CardContent>
													<Typography variant="h6">Topography</Typography>
													<pre>
														{JSON.stringify(stratifiedData.topography, null, 2)}
													</pre>
												</CardContent>
											</Card>
										</Grid>

										{/* Histology */}
										<Grid item xs={12} sm={6} md={4}>
											<Card variant="outlined">
												<CardContent>
													<Typography variant="h6">Histology</Typography>
													<pre>
														{JSON.stringify(stratifiedData.histology, null, 2)}
													</pre>
												</CardContent>
											</Card>
										</Grid>

										{/* Behavior */}
										<Grid item xs={12} sm={6} md={4}>
											<Card variant="outlined">
												<CardContent>
													<Typography variant="h6">Behavior</Typography>
													<pre>
														{JSON.stringify(stratifiedData.behavior, null, 2)}
													</pre>
												</CardContent>
											</Card>
										</Grid>

										{/* Grade */}
										<Grid item xs={12} sm={6} md={4}>
											<Card variant="outlined">
												<CardContent>
													<Typography variant="h6">Grade</Typography>
													<pre>
														{JSON.stringify(stratifiedData.grade, null, 2)}
													</pre>
												</CardContent>
											</Card>
										</Grid>

										{/* Basis of Diagnosis */}
										<Grid item xs={12} sm={6} md={4}>
											<Card variant="outlined">
												<CardContent>
													<Typography variant="h6">
														Basis of Diagnosis
													</Typography>
													<pre>
														{JSON.stringify(
															stratifiedData.basisOfDiagnosis,
															null,
															2
														)}
													</pre>
												</CardContent>
											</Card>
										</Grid>
									</Grid>
								</div>
							)}
						</div>
					)}
					{/* Step 7: Consolidate Data */}
					{activeStep === 6 && (
						<div>
							{/* Display Consolidation Status */}
							<Typography variant="h6" style={{ marginTop: "20px" }}>
								Consolidation
							</Typography>

							{/* Display Button for Consolidation */}
							<Button
								variant="contained"
								color="primary"
								onClick={() => consolidateData(file)} // Assuming `file` is the selected file object
							>
								Consolidate Data
							</Button>

							{consolidationStatus && (
								<Typography
									variant="body1"
									style={{ marginTop: "20px", color: "blue" }}
								>
									{consolidationStatus}
								</Typography>
							)}
						</div>
					)}
					{/* Step 8: Review and Finalize */}
					{/* Snackbar for user feedback */}
					<Snackbar
						open={openSnackbar}
						autoHideDuration={6000}
						onClose={handleCloseSnackbar}
					>
						<Alert onClose={handleCloseSnackbar} severity={snackbarSeverity}>
							{snackbarMessage}
						</Alert>
					</Snackbar>
					{/* Step 8: Summary */}
					{activeStep === 7 && (
						<div>
							{/* Corrections Log */}
							{(corrections.topography.length > 0 ||
								corrections.histology.length > 0 ||
								corrections.sex.length > 0) && (
								<StyledSection>
									<Typography variant="h6">Corrections Log:</Typography>
									<Typography variant="body1" style={{ marginTop: "10px" }}>
										The table below summarizes the corrections made during the
										auto-correction process. Each entry shows the original
										value, the corrected value, and the confidence level of the
										correction.
									</Typography>
									{/* Conditional Rendering with Error Messages */}
									{correctionError ? (
										<Typography color="error" sx={{ marginTop: 2 }}>
											{correctionError}
										</Typography>
									) : correctionColumns.length > 0 &&
									  correctionRows.length > 0 ? (
										<StyledDataGrid
											rows={correctionRows}
											columns={correctionColumns}
											pageSize={10}
											disableSelectionOnClick
											autoHeight
										/>
									) : (
										<Typography color="error" sx={{ marginTop: 2 }}>
											Correction data is unavailable.
										</Typography>
									)}
								</StyledSection>
							)}

							{/* Validation Results */}
							{validationResults.length > 0 && (
								<StyledSection>
									<Typography variant="h6">Validation Results:</Typography>
									<Typography variant="body1" style={{ marginTop: "10px" }}>
										The table below lists all entries that were omitted due to
										validation failures. Each entry includes the registration
										number and the reason for the validation failure.
									</Typography>
									{/* Conditional Rendering with Error Messages */}
									{validationError ? (
										<Typography color="error" sx={{ marginTop: 2 }}>
											{validationError}
										</Typography>
									) : validatedColumns.length > 0 &&
									  validatedRows.length > 0 ? (
										<StyledDataGrid
											rows={validatedRows}
											columns={validatedColumns}
											pageSize={10}
											disableSelectionOnClick
											autoHeight
										/>
									) : (
										<Typography color="error" sx={{ marginTop: 2 }}>
											Validation data is unavailable.
										</Typography>
									)}
								</StyledSection>
							)}

							{/* No Issues Found */}
							{corrections.topography.length === 0 &&
								corrections.histology.length === 0 &&
								corrections.sex.length === 0 &&
								validationResults.length === 0 && (
									<Typography variant="body1" component={StyledSection}>
										No corrections or validation issues found.
									</Typography>
								)}

							{/* Finish Button */}
							<FinishButton
								variant="contained"
								color="primary"
								onClick={() => {
									resetAll();
									console.log("User has reviewed the summary.");
								}}
							>
								Finish
							</FinishButton>
						</div>
					)}
					{/* Back and Next Buttons */}
					<div style={{ marginTop: "20px" }}>
						<Button onClick={handleBack} disabled={activeStep === 0 || loading}>
							Back
						</Button>
						<Button
							onClick={handleNext}
							disabled={
								loading ||
								(activeStep === 0 && (!file || isLoading)) ||
								(activeStep === 1 && missingColumns.length > 0) ||
								(activeStep === 2 && duplicateRows.length > 0) ||
								(activeStep === 3 && !isAutoCorrectionDone) ||
								(activeStep === 4 && isValidationLoading)
							}
							variant="contained"
							color="primary"
							style={{ marginLeft: "10px" }}
						>
							Next
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
Eda.protected = true;

export default Eda;
