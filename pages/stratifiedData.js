import { useState, useEffect } from "react";
import {
	Card,
	CardContent,
	Typography,
	Container,
	Grid,
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	Button,
	Box,
	Divider,
	Checkbox,
	ListItemText,
} from "@mui/material";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
	LineChart,
	Line,
	ScatterChart,
	Scatter,
} from "recharts";
import { apiRequest } from "./utils/api";

const colors = ["#1CABE2", "#FF7F50", "#FFB6C1", "#82CA9D"];

export default function StratifiedData() {
	const [data, setData] = useState(null);
	const [filteredData, setFilteredData] = useState(null);
	const [filters, setFilters] = useState([]);
	const [drillDownData, setDrillDownData] = useState(null);
	const [metrics, setMetrics] = useState(null);
	const [dropdownOpen, setDropdownOpen] = useState(false); // Controls dropdown visibility
	const [insightType, setInsightType] = useState("Trend Analysis"); // Default view for insight type
	const [trendData, setTrendData] = useState([]);
	const [correlationData, setCorrelationData] = useState([]);

	// Fetch initial data on component load
	useEffect(() => {
		const fetchData = async () => {
			try {
				const response = await apiRequest("stratified-data/", "GET");
				console.log("stratified data", { response });
				setData(response);
				setFilteredData(response); // Initialize with all data
				computeMetrics(response); // Calculate metrics on initial data load
				setTrendData(processTrendData(response));
				setCorrelationData(processCorrelationData(response));
			} catch (error) {
				console.error("Failed to fetch stratified data:", error);
			}
		};
		fetchData();
	}, []);

	// Handle filtering based on user selection
	const handleFilterChange = (event) => {
		const selectedFilters = event.target.value;

		setFilters(selectedFilters);
		setDropdownOpen(false); // Close dropdown after selection

		if (selectedFilters.length === 0) {
			setFilteredData(data); // Reset to show all data when filters are cleared
		} else {
			const newFilteredData = Object.keys(data).reduce((acc, key) => {
				acc[key] = data[key].filter((entry) =>
					selectedFilters.every((filter) => entry[filter])
				);
				return acc;
			}, {});
			setFilteredData(newFilteredData);
		}
	};

	// Clear filters and reset to full data view
	const handleClearFilters = () => {
		setFilters([]);
		setFilteredData(data); // Reset filteredData to original data
	};

	// Drill-down with enhanced data display
	const handleDrillDown = (chartData, xAxisKey) => {
		if (!chartData || !chartData.length) return;

		const detailedData = chartData.map((d) => ({
			...d.payload,
			xAxisKey,
		}));
		setDrillDownData(detailedData);
	};

	// Calculate metrics for visual summaries
	const computeMetrics = (data) => {
		const totalRecords = Object.values(data).reduce(
			(acc, arr) => acc + arr.length,
			0
		);
		const sexDistribution = data.by_sex
			? data.by_sex.reduce(
					(acc, item) => ({
						...acc,
						[item.sex]: ((item.count / totalRecords) * 100).toFixed(2),
					}),
					{}
				)
			: {};
		setMetrics({ totalRecords, sexDistribution });
	};

	// Process Trend Data (simulated for this example)
	const processTrendData = (data) => {
		if (!data || !data.by_grade) return [];
		return data.by_grade.map((item) => ({
			grade: item.topography,
			count: item.count,
		}));
	};

	// Process Correlation Data
	const processCorrelationData = (data) => {
		if (!data || !data.by_sex || !data.by_behavior) return [];
		return data.by_sex.map((item, index) => ({
			sex: item.sex === "1" ? "Male" : "Female",
			behavior: data.by_behavior[index] ? data.by_behavior[index].behavior : "",
			count: item.count,
		}));
	};

	// Process data for Topography vs. Histology
	const processTopographyHistologyData = (data) => {
		if (!data || !data.by_topography || !data.by_histology) return [];

		const histologyMap = data.by_histology.reduce(
			(acc, { histology, count }) => {
				acc[histology] = count;
				return acc;
			},
			{}
		);

		return data.by_topography.map(({ topography, count }) => ({
			topography,
			histologyCount: histologyMap[topography] || 0,
		}));
	};

	// Process data for Behavior vs. Grade Code
	const processBehaviorGradeData = (data) => {
		if (!data || !data.by_behavior || !data.by_grade) return [];

		const gradeMap = data.by_grade.reduce((acc, { grade_code, count }) => {
			acc[grade_code] = count;
			return acc;
		}, {});

		return data.by_behavior.map(({ behavior, count }) => ({
			behavior,
			gradeCount: gradeMap[behavior] || 0,
		}));
	};

	// Process data for Basis of Diagnosis vs. Sex
	const processDiagnosisSexData = (data) => {
		if (!data || !data.by_basis_of_diagnosis || !data.by_sex) return [];

		const sexMap = data.by_sex.reduce((acc, { sex, count }) => {
			const gender = sex === "1" ? "Male" : "Female";
			acc[gender] = count;
			return acc;
		}, {});

		return data.by_basis_of_diagnosis.map(({ basis_of_diagnosis, count }) => ({
			diagnosis: basis_of_diagnosis.trim(),
			maleCount: sexMap["Male"] || 0,
			femaleCount: sexMap["Female"] || 0,
		}));
	};

	if (!data) return <Typography>Loading...</Typography>;

	return (
		<Container maxWidth="lg" style={{ paddingTop: "2rem" }}>
			<Typography variant="h4" align="center" gutterBottom>
				Stratified Data Analysis Dashboard
			</Typography>

			{/* Metric Summary Section */}
			<Box my={4} display="flex" justifyContent="space-around">
				{metrics && (
					<>
						<Card elevation={2} style={{ padding: "1rem", minWidth: "150px" }}>
							<Typography variant="h6">Total Records</Typography>
							<Typography variant="h5">{metrics.totalRecords}</Typography>
						</Card>
						<Card elevation={2} style={{ padding: "1rem", minWidth: "150px" }}>
							<Typography variant="h6">Sex Distribution</Typography>
							<PieChart width={100} height={100}>
								<Pie
									data={Object.entries(metrics.sexDistribution).map(
										([name, value]) => ({ name, value: Number(value) })
									)}
									dataKey="value"
									outerRadius={40}
									fill="#8884d8"
								>
									{Object.keys(metrics.sexDistribution).map((_, index) => (
										<Cell
											key={`cell-${index}`}
											fill={colors[index % colors.length]}
										/>
									))}
								</Pie>
								<Tooltip />
							</PieChart>
						</Card>
					</>
				)}
			</Box>

			{/* Multi-Filter Controls */}
			<Box mb={4}>
				<Grid container spacing={2} alignItems="center">
					<Grid item xs={12} md={8}>
						<FormControl fullWidth>
							<InputLabel>Filter By</InputLabel>
							<Select
								multiple
								open={dropdownOpen} // Control dropdown visibility
								onOpen={() => setDropdownOpen(true)}
								onClose={() => setDropdownOpen(false)}
								value={filters}
								onChange={handleFilterChange}
								renderValue={(selected) =>
									selected.length ? selected.join(", ") : "None"
								}
							>
								{/* List of Filter Options with Checkbox */}
								{/* "None" Option to Clear All Filters */}
								<MenuItem
									value=""
									onClick={() => setFilters([])} // Clear all filters
								>
									<Checkbox checked={filters.length === 0} />
									<ListItemText primary="None" />
								</MenuItem>
								<MenuItem value="sex">
									<Checkbox checked={filters.includes("sex")} />
									<ListItemText primary="Sex" />
								</MenuItem>
								<MenuItem value="topography">
									<Checkbox checked={filters.includes("topography")} />
									<ListItemText primary="Topography" />
								</MenuItem>
								<MenuItem value="histology">
									<Checkbox checked={filters.includes("histology")} />
									<ListItemText primary="Histology" />
								</MenuItem>
								<MenuItem value="behavior">
									<Checkbox checked={filters.includes("behavior")} />
									<ListItemText primary="Behavior" />
								</MenuItem>
								<MenuItem value="grade_code">
									<Checkbox checked={filters.includes("grade_code")} />
									<ListItemText primary="Grade Code" />
								</MenuItem>
								<MenuItem value="basis_of_diagnosis">
									<Checkbox checked={filters.includes("basis_of_diagnosis")} />
									<ListItemText primary="Basis of Diagnosis" />
								</MenuItem>
							</Select>
						</FormControl>
					</Grid>
					<Grid item xs={12} md={4}>
						<Button
							variant="contained"
							color="primary"
							fullWidth
							onClick={handleClearFilters}
						>
							Clear Filters
						</Button>
					</Grid>
				</Grid>
			</Box>

			{/* Data Display Section */}
			<Grid container spacing={4}>
				{Object.keys(filteredData).map((key, index) => {
					if (!filteredData[key] || filteredData[key].length === 0) return null;

					const xAxisKey = Object.keys(filteredData[key][0])[0];

					return (
						<Grid item xs={12} md={6} key={index}>
							<Card elevation={3} sx={{ height: "100%" }}>
								<CardContent>
									<Typography variant="h6" gutterBottom>
										{`Data by ${key.replace("by_", "").replaceAll("_", " ")}`}
									</Typography>
									<ResponsiveContainer width="100%" height={300}>
										<BarChart
											data={filteredData[key]}
											layout="vertical"
											onClick={(e) =>
												handleDrillDown(e.activePayload, xAxisKey)
											}
										>
											<CartesianGrid strokeDasharray="3 3" />
											<XAxis type="number" />
											<YAxis dataKey={xAxisKey} type="category" />
											<Tooltip />
											<Legend />
											<Bar dataKey="count" fill="#1CABE2" />
										</BarChart>
									</ResponsiveContainer>
								</CardContent>
							</Card>
						</Grid>
					);
				})}
			</Grid>

			{/* Drill-Down Data Display */}
			{drillDownData && (
				<Box mt={4}>
					<Divider />
					<Typography variant="h5" align="center" gutterBottom>
						Drill-Down Details
					</Typography>
					<Grid container spacing={2}>
						{drillDownData.map((detail, i) => (
							<Grid item xs={12} sm={6} md={4} key={i}>
								<Card>
									<CardContent>
										<Typography variant="subtitle1">
											<strong>{detail[detail.xAxisKey]}</strong>
										</Typography>
										<Typography>Count: {detail.count}</Typography>
										{/* Add more fields for additional detail */}
									</CardContent>
								</Card>
							</Grid>
						))}
					</Grid>
				</Box>
			)}

			{/* Insight Type Selector */}
			<Box my={4}>
				<FormControl fullWidth>
					<InputLabel>Insight Type</InputLabel>
					<Select
						value={insightType}
						onChange={(e) => setInsightType(e.target.value)}
					>
						<MenuItem value="Trend Analysis">Trend Analysis</MenuItem>
						<MenuItem value="Demographics">Demographics Breakdown</MenuItem>
						<MenuItem value="Correlation Analysis">
							Correlation Analysis
						</MenuItem>
						<MenuItem value="Topography vs Histology">
							Topography vs Histology
						</MenuItem>
						<MenuItem value="Behavior vs Grade Code">
							Behavior vs Grade Code
						</MenuItem>
						<MenuItem value="Diagnosis vs Sex">Diagnosis vs Sex</MenuItem>
					</Select>
				</FormControl>
			</Box>

			{/* Display Data Based on Selected Insight */}
			<Box my={4}>
				{insightType === "Trend Analysis" && (
					<ResponsiveContainer width="100%" height={400}>
						<LineChart data={trendData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="grade" />
							<YAxis />
							<Tooltip />
							<Legend />
							<Line type="monotone" dataKey="count" stroke="#1CABE2" />
						</LineChart>
					</ResponsiveContainer>
				)}

				{insightType === "Demographics" && (
					<ResponsiveContainer width="100%" height={400}>
						<PieChart>
							<Pie
								data={Object.entries(metrics.sexDistribution).map(
									([name, value]) => ({ name, value: Number(value) })
								)}
								dataKey="value"
								outerRadius={100}
								fill="#82CA9D"
								label
							>
								{Object.keys(metrics.sexDistribution).map((_, index) => (
									<Cell
										key={`cell-${index}`}
										fill={colors[index % colors.length]}
									/>
								))}
							</Pie>
							<Tooltip />
							<Legend />
						</PieChart>
					</ResponsiveContainer>
				)}

				{insightType === "Correlation Analysis" && (
					<ResponsiveContainer width="100%" height={400}>
						<ScatterChart>
							<CartesianGrid />
							<XAxis type="category" dataKey="sex" name="Sex" />
							<YAxis type="number" dataKey="count" name="Count" />
							<Tooltip cursor={{ strokeDasharray: "3 3" }} />
							<Scatter
								name="Sex vs. Behavior"
								data={correlationData}
								fill="#1CABE2"
							/>
						</ScatterChart>
					</ResponsiveContainer>
				)}
				{insightType === "Topography vs Histology" && (
					<ResponsiveContainer width="100%" height={400}>
						<BarChart data={processTopographyHistologyData(data)}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="topography" />
							<YAxis />
							<Tooltip />
							<Legend />
							<Bar
								dataKey="histologyCount"
								fill="#1CABE2"
								name="Histology Count"
							/>
						</BarChart>
					</ResponsiveContainer>
				)}

				{insightType === "Behavior vs Grade Code" && (
					<ResponsiveContainer width="100%" height={400}>
						<ScatterChart>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="behavior" name="Behavior" />
							<YAxis dataKey="gradeCount" name="Grade Count" />
							<Tooltip />
							<Legend />
							<Scatter
								name="Behavior vs Grade"
								data={processBehaviorGradeData(data)}
								fill="#FF7F50"
							/>
						</ScatterChart>
					</ResponsiveContainer>
				)}

				{insightType === "Diagnosis vs Sex" && (
					<ResponsiveContainer width="100%" height={400}>
						<BarChart data={processDiagnosisSexData(data)} layout="vertical">
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis type="number" />
							<YAxis dataKey="diagnosis" type="category" />
							<Tooltip />
							<Legend />
							<Bar dataKey="maleCount" fill="#1CABE2" name="Male Count" />
							<Bar dataKey="femaleCount" fill="#FFB6C1" name="Female Count" />
						</BarChart>
					</ResponsiveContainer>
				)}
			</Box>
		</Container>
	);
}
