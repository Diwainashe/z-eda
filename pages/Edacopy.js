// Eda.js

import withAuth from "./hoc/withAuth";
import {
	FormControl,
	InputLabel,
	Select,
	Stepper,
	MenuItem,
	Step,
	StepLabel,
	Button,
	Typography,
	TextField,
	CircularProgress,
	List,
	ListItem,
	ListItemIcon,
	ListItemText,
	Snackbar,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import React, { useState, useEffect, useRef } from "react";
import Papa from "papaparse"; // For CSV parsing
import { apiRequest } from "./utils/api"; // API Request Utility
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";
import MuiAlert from "@mui/material/Alert";
import * as XLSX from "xlsx";

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
	const [validationProgress, setValidationProgress] = useState([]); // Progress messages
	const [validationLogs, setValidationLogs] = useState([]); // Detailed validation logs
	const [openSnackbar, setOpenSnackbar] = useState(false);
	const [error, setError] = useState(null);
	const [validationId, setValidationId] = useState(null); // Track the validation ID for WebSocket
	const [isValidationCompleted, setIsValidationCompleted] = useState(false); // Flag for validation completion
	const [warnings, setWarnings] = useState([]);

	const ws = useRef(null); // WebSocket reference

	// Alert Component for Snackbar
	const Alert = (props) => {
		return <MuiAlert elevation={6} variant="filled" {...props} />;
	};

	// WebSocket useEffect to listen for validation progress
	useEffect(() => {
		let socket;

		if (validationId) {
			const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
			const backendHost = "localhost:8000";
			const wsUrl = `${wsProtocol}://${backendHost}/ws/validations/${validationId}/`;

			console.log("Connecting to WebSocket:", wsUrl);

			socket = new WebSocket(wsUrl);

			socket.onopen = () => {
				console.log("WebSocket connection established.");
				setValidationLogs((prevLogs) => [
					...prevLogs,
					{ type: "info", message: "WebSocket connection established." },
				]);
			};

			socket.onmessage = (event) => {
				const data = JSON.parse(event.data);
				console.log("WebSocket message received:", data);

				if (data.type && data.message) {
					// Append each log message
					setValidationLogs((prevLogs) => [...prevLogs, data]);

					// Handle completion or failure
					if (data.type === "success" && data.message.includes("completed")) {
						setIsValidationCompleted(true);
						setProgressMessage(data.message);
						setIsValidationLoading(false);
						socket.close();
					} else if (data.type === "error") {
						setError(data.message);
						setOpenSnackbar(true);
						setIsValidationLoading(false);
						socket.close();
					}
				}
			};

			socket.onerror = (error) => {
				console.error("WebSocket error:", error);
				setValidationLogs((prevLogs) => [
					...prevLogs,
					{ type: "error", message: "WebSocket connection error." },
				]);
				setError("WebSocket connection error.");
				setOpenSnackbar(true);
			};

			socket.onclose = () => {
				console.log("WebSocket connection closed.");
				setValidationLogs((prevLogs) => [
					...prevLogs,
					{ type: "info", message: "WebSocket connection closed." },
				]);
			};
		}

		// Cleanup on unmount
		return () => {
			if (socket) {
				socket.close();
			}
		};
	}, [validationId]);

	const handleStratifyData = async () => {
		if (!validationId) {
			alert("Validation ID is missing.");
			return;
		}

		setLoading(true);
		setStratificationStatus("Stratification initiated...");

		try {
			const response = await axios.post("/stratify/", {
				validation_id: validationId,
			});

			if (response.status === 200) {
				setStratificationStatus("Stratification task started.");
				// The actual status updates will come via WebSocket
			} else {
				setStratificationStatus("Stratification encountered issues.");
			}
		} catch (error) {
			console.error("Error stratifying data:", error);
			setStratificationStatus("Error during data stratification.");
			setWarnings(["Failed to stratify data. Please try again."]);
		} finally {
			setLoading(false);
		}
	};

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

	// Parse XLSX Files
	const parseAndCleanXLSX = (rawData) => {
		const workbook = XLSX.read(rawData, { type: "binary" });

		const firstSheetName = workbook.SheetNames[0];
		const worksheet = workbook.Sheets[firstSheetName];

		const parsedData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

		return cleanFileData(parsedData);
	};

	// Parse JSON Files
	const parseAndCleanJSON = (rawData) => {
		try {
			const parsedData = JSON.parse(rawData);
			if (Array.isArray(parsedData)) {
				return cleanFileData(parsedData);
			} else {
				return cleanFileData([parsedData]);
			}
		} catch (error) {
			console.error("JSON parsing error:", error);
			return null;
		}
	};

	// Function to handle file change event (parsing only)
	const handleFileChange = (event) => {
		const selectedFile = event.target.files[0];
		if (selectedFile) {
			const fileFormat = selectedFile.name.split(".").pop().toLowerCase();

			const reader = new FileReader();

			reader.onload = (e) => {
				const rawData = e.target.result;
				let parsedData = null;

				if (fileFormat === "csv") {
					parsedData = parseAndCleanCSV(rawData);
				} else if (fileFormat === "xlsx" || fileFormat === "xls") {
					parsedData = parseAndCleanXLSX(rawData);
				} else if (fileFormat === "json") {
					parsedData = parseAndCleanJSON(rawData);
				}

				if (parsedData) {
					if (validateData(parsedData)) {
						setFileData(parsedData); // For submission
						setPreviewData(parsedData); // For preview
						setProgressMessage("File parsed and cleaned successfully.");
					} else {
						setPreviewData(null); // Clear preview if validation fails
						// setProgressMessage is already set in validateData
					}
				} else {
					setProgressMessage(
						"Failed to parse the file. Please ensure it's a valid CSV, XLSX, or JSON file."
					);
					setPreviewData(null);
				}
			};

			if (fileFormat === "csv" || fileFormat === "json") {
				reader.readAsText(selectedFile);
			} else if (fileFormat === "xlsx" || fileFormat === "xls") {
				reader.readAsBinaryString(selectedFile);
			} else {
				setProgressMessage(
					"Unsupported file format. Please upload a CSV, XLSX, or JSON file."
				);
				setPreviewData(null);
			}

			setFile(selectedFile); // Store the selected file for submission
		}
	};

	// Function to handle file submission (consolidation and further processing)
	const handleFileSubmit = () => {
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
				setProgressMessage(
					"File validated and data consolidated successfully."
				);
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

	// Generic Data Validation
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
			if (!validateCsvData(fileData)) {
				setProgressMessage(
					"Data validation failed. Please check the required columns."
				);
			}
		}
	}, [fileData]);

	// Step 3: Remove Duplicates (retain the earliest 'date_of_incidence')
	const handleRemoveDuplicates = () => {
		if (!duplicateRows || duplicateRows.length === 0) {
			setProgressMessage("No duplicates available for removal.");
			return;
		}

		const seenRegistrationNumbers = {};
		const cleanedData = fullData.filter((row) => {
			const regNumber = row.registration_number;
			const incidenceDate = new Date(row.date_of_incidence);

			if (seenRegistrationNumbers[regNumber]) {
				const existingDate = new Date(
					seenRegistrationNumbers[regNumber].date_of_incidence
				);
				if (incidenceDate < existingDate) {
					// If current row has an earlier 'date_of_incidence', update to keep this one
					seenRegistrationNumbers[regNumber] = row;
					return true;
				} else {
					// Otherwise, skip this row as a duplicate
					return false;
				}
			} else {
				// If not seen, add to seen registration numbers
				seenRegistrationNumbers[regNumber] = row;
				return true;
			}
		});

		setFileData(cleanedData);
		setDuplicateRows([]);
		setProgressMessage("Duplicates removed successfully.");
		setDuplicatesRemoved(true);
	};

	// Function to handle the auto-correction API call
	const handleAutoCorrect = async () => {
		if (!validateDataset(fileData)) {
			setProgressMessage(
				"Error: Invalid dataset structure. Please check the data."
			);
			console.error("Dataset is invalid.");
			setError("Error: Invalid dataset structure.");
			setOpenSnackbar(true);
			return;
		}

		setIsLoading(true);
		setProgressMessage("");

		try {
			// Trigger the auto-correction API call
			const response = await apiRequest("auto-correct-codes/", "POST", {
				dataset: fileData,
			});

			const { upload_id, corrected_data, corrections } = response;

			setValidationId(upload_id); // Set validationId to establish WebSocket connection
			setCorrectedData(corrected_data); // Set the corrected data
			setCorrections(corrections); // Set the corrections data
			setIsAutoCorrectionDone(true);
			setProgressMessage("Auto-correction completed successfully.");
		} catch (error) {
			console.error("Error during auto-correction:", error);
			setProgressMessage("Error during auto-correction.");
			setError("Error during auto-correction.");
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

	// Function to handle running all validations
	const handleRunAllValidations = async () => {
		setIsValidationLoading(true);
		setProgressMessage("");
		setValidationProgress([]);
		setValidationLogs([]);
		setValidationResults([]);
		setError(null);
		setOpenSnackbar(false);

		try {
			const data = await apiRequest("run-all-validations/", "POST", {
				dataset: correctedData,
			});

			const { validation_id } = data; // Corrected to use 'data'
			setValidationId(validation_id);

			setProgressMessage("Validations started...");
		} catch (err) {
			console.error("Error initiating validations:", err);
			setError(err.message || "Failed to initiate validations.");
			setIsValidationLoading(false);
			setOpenSnackbar(true);
		}
	};

	// Function to handle closing the Snackbar
	const handleCloseSnackbar = (event, reason) => {
		if (reason === "clickaway") {
			return;
		}
		setOpenSnackbar(false);
	};

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

	// Mapping columns and rows for DataGrid
	const columns =
		fileData &&
		Object.keys(fileData[0]).map((key) => ({
			field: key,
			headerName: key,
			flex: 1,
			minWidth: 150,
		}));

	const rows =
		fileData &&
		fileData.map((row, index) => ({
			id: index,
			...row,
		}));

	// Mapping for Validation Results DataGrid
	const validationColumns = [
		{ field: "record_id", headerName: "Record ID", width: 100 },
		{ field: "status", headerName: "Status", width: 120 },
		{
			field: "error_type",
			headerName: "Error Type",
			width: 200,
			renderCell: (params) => params.value || "N/A",
		},
		{
			field: "error_message",
			headerName: "Error Message",
			flex: 1,
			minWidth: 250,
			renderCell: (params) => params.value || "N/A",
		},
	];

	const validationRows =
		validationResults &&
		validationResults.map((result, index) => ({
			id: index,
			record_id: result.record_id,
			status: result.is_valid ? "Valid" : "Not Valid",
			error_type: result.error_type || "",
			error_message: result.error_message || "",
		}));

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
								inputProps={{ accept: ".csv,.xlsx,.xls,.json" }}
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

					{/* Step 2: Inspect Data Schema */}
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
								<DataGrid
									rows={rows}
									columns={columns}
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
									<div style={{ height: 750, width: "100%" }}>
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

							{/* Display loading indicator while validations are processing */}
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
							{validationLogs.length > 0 && (
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
							)}

							{/* Show validation results if completed */}
							{isValidationCompleted && (
								<div>
									<Typography variant="h6" style={{ marginTop: "20px" }}>
										Validation Results:
									</Typography>
									<div
										style={{ height: 400, width: "100%", marginTop: "10px" }}
									>
										<DataGrid
											rows={validationRows}
											columns={validationColumns}
											pageSize={10}
											disableSelectionOnClick
										/>
									</div>

									{/* Download Report Button 
									<Button
										variant="contained"
										color="primary"
										style={{ marginTop: "20px" }}
										onClick={downloadReport}
									>
										Download Validation Report
									</Button> */}
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
									onClick={handleStratifyData}
									disabled={loading}
								>
									Stratify Data
								</Button>
							</Box>
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

export default withAuth(Eda);
