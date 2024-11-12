import React, { useState, useEffect } from "react";
import {
	BarChart,
	Bar,
	LineChart,
	Line,
	PieChart,
	Pie,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
	ComposedChart,
	Cell,
} from "recharts";
import {
	Card,
	CardActionArea,
	CardContent,
	Typography,
	Grid,
	Container,
} from "@mui/material";
import { apiRequest } from "./utils/api";

const CancerRegistryDashboard = () => {
	const [data, setData] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [chartType, setChartType] = useState("topographyBar");
	// Initialize viewBySex to true
	const [viewBySex, setViewBySex] = useState(true);
	const [filters, setFilters] = useState({
		sex: "all",
		ageGroup: "all",
		diagnosis: "all",
	});

	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			try {
				const response = await apiRequest("masterdata/", "GET");
				let dataArray = Array.isArray(response) ? response : [response];
				setData(dataArray);
				setLoading(false);
			} catch (error) {
				setError(error.message);
				setLoading(false);
			}
		};
		fetchData();
	}, [filters]);

	// Data processing functions for each chart
	const processTopographyData = () => {
		const topographyData = data.reduce(
			(acc, record) => {
				if (viewBySex) {
					// Separate counts for Males and Females
					if (record.sex === "1") {
						acc.males[record.topography] =
							(acc.males[record.topography] || 0) + 1;
					} else if (record.sex === "2") {
						acc.females[record.topography] =
							(acc.females[record.topography] || 0) + 1;
					}
				} else {
					acc.total[record.topography] =
						(acc.total[record.topography] || 0) + 1;
				}
				return acc;
			},
			{ males: {}, females: {}, total: {} }
		);

		return Object.keys(
			viewBySex ? topographyData.males : topographyData.total
		).map((topography) => ({
			name: topography,
			// If viewing by sex, make male counts negative for mirroring
			males: viewBySex ? -(topographyData.males[topography] || 0) : 0,
			females: viewBySex ? topographyData.females[topography] || 0 : 0,
			cases: topographyData.total[topography] || 0,
		}));
	};

	const processTimeSeriesData = () => {
		const timeSeriesData = data.reduce((acc, record) => {
			const year = new Date(record.date_of_incidence).getFullYear();
			acc[year] = (acc[year] || 0) + 1;
			return acc;
		}, {});
		return Object.entries(timeSeriesData).map(([year, cases]) => ({
			year,
			cases,
		}));
	};

	const processAgeDistribution = () => {
		const currentYear = new Date().getFullYear();
		const ageGroups = {
			"56+": { males: 0, females: 0 },
			"36-55": { males: 0, females: 0 },
			"19-35": { males: 0, females: 0 },
			"0-18": { males: 0, females: 0 },
		};

		data.forEach((record) => {
			const birthYear = new Date(record.birth_date).getFullYear();
			const age = currentYear - birthYear;
			const sex = record.sex; // Assuming '1' for male, '2' for female

			if (age <= 18) {
				if (sex === "1") ageGroups["0-18"].males++;
				else if (sex === "2") ageGroups["0-18"].females++;
			} else if (age <= 35) {
				if (sex === "1") ageGroups["19-35"].males++;
				else if (sex === "2") ageGroups["19-35"].females++;
			} else if (age <= 55) {
				if (sex === "1") ageGroups["36-55"].males++;
				else if (sex === "2") ageGroups["36-55"].females++;
			} else {
				if (sex === "1") ageGroups["56+"].males++;
				else if (sex === "2") ageGroups["56+"].females++;
			}
		});

		// Return data with negative counts for males to mirror them
		return Object.entries(ageGroups).map(([ageGroup, counts]) => ({
			ageGroup,
			males: -counts.males, // Negative for mirroring
			females: counts.females, // Positive values for females
		}));
	};

	const processHeatMapData = () => {
		const ageSexData = data.reduce((acc, record) => {
			const birthYear = new Date(record.birth_date).getFullYear();
			const age = new Date().getFullYear() - birthYear;
			let ageGroup = "";

			if (age <= 18) ageGroup = "0-18";
			else if (age <= 35) ageGroup = "19-35";
			else if (age <= 55) ageGroup = "36-55";
			else ageGroup = "56+";

			if (!acc[ageGroup]) acc[ageGroup] = { Males: 0, Females: 0 };
			if (record.sex === "1") acc[ageGroup]["Males"] += 1;
			if (record.sex === "2") acc[ageGroup]["Females"] += 1;

			return acc;
		}, {});

		return Object.entries(ageSexData).map(([ageGroup, counts]) => ({
			ageGroup,
			males: counts["Males"],
			females: counts["Females"],
		}));
	};

	// Function to process pie chart data based on a specific field for grouping
	const processPieData = () => {
		const groupByField = "topography"; // Set the field to group by (e.g., "ageGroup" or "diagnosis")

		// Aggregate data by the specified field
		const pieData = data.reduce((acc, record) => {
			const groupValue = record[groupByField];

			// Initialize the group in acc if it doesn't exist
			if (!acc[groupValue]) {
				acc[groupValue] = 0;
			}
			// Increment the count for the group
			acc[groupValue] += 1;

			return acc;
		}, {});

		// Convert the aggregated object data into an array format suitable for recharts
		return Object.entries(pieData).map(([name, value]) => ({
			name,
			value,
		}));
	};

	// Loading and error states
	if (loading) {
		return (
			<div className="flex justify-center items-center h-screen">
				Loading data...
			</div>
		);
	}

	if (error) {
		return <div className="text-red-500">Error loading data: {error}</div>;
	}

	const chartData = processTopographyData();
	const ageDistributionData = processAgeDistribution();
	const timeSeriesData = processTimeSeriesData();
	const heatMapData = processHeatMapData();
	const pieChartData = processPieData();

	const colors = ["#8884d8", "#82ca9d", "#ffc658", "#ff7f0e", "#1f77b4"];

	// Chart selection cards
	const chartTypes = [
		{ label: "Topography Bar", type: "topographyBar" },
		{ label: "Time Series", type: "timeSeries" },
		{ label: "Age Distribution", type: "ageDistribution" },
		{ label: "Pie Chart", type: "pieChart" },
		{ label: "Heat Map", type: "heatMap" },
	];

	const styles = {
		card: {
			width: "100%",
			height: "100%",
			backgroundColor: "#ffffff",
			boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
			borderRadius: "8px",
			textAlign: "center",
		},
		selectedCard: {
			backgroundColor: "#1CABE2",
			color: "white",
		},
		cardTitle: {
			fontSize: "1rem",
			color: "#333",
			fontWeight: "bold",
		},
		pageTitle: {
			textAlign: "center",
			marginBottom: "20px",
			color: "#1CABE2",
		},
		gridContainer: {
			marginBottom: "20px",
		},
	};

	return (
		<div className="flex">
			{/* Parameter Controls Section */}
			<div className="w-1/4 p-4 bg-gray-100">
				<h2 className="text-xl font-bold mb-4">Controls</h2>
				{/* Filter options here */}
			</div>

			{/* Chart Display Section */}
			<div className="w-3/4 p-6">
				<h1 className="text-3xl font-bold mb-8 text-gray-800">
					Cancer Registry Analysis Dashboard
				</h1>
				<Container>
					<Grid container spacing={3} style={styles.gridContainer}>
						{chartTypes.map(({ label, type }) => (
							<Grid item xs={6} sm={4} md={2} key={type}>
								<Card
									style={{
										...styles.card,
										...(chartType === type ? styles.selectedCard : {}),
									}}
								>
									<CardActionArea onClick={() => setChartType(type)}>
										<CardContent>
											<Typography variant="h6" style={styles.cardTitle}>
												{label}
											</Typography>
										</CardContent>
									</CardActionArea>
								</Card>
							</Grid>
						))}
					</Grid>
				</Container>

				{/* Chart Content Section */}
				<div className="bg-white p-6 rounded-lg shadow-lg">
					{/* Render the appropriate chart here */}
				</div>

				<div className="bg-white p-4 rounded-lg shadow">
					{/* Render the appropriate chart based on chartType */}
					{/* // Render the mirrored bar chart */}
					{chartType === "topographyBar" && (
						<ResponsiveContainer width="100%" height={400}>
							<BarChart data={chartData} layout="vertical" barCategoryGap="20%">
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis
									type="number"
									domain={[-100, 100]} // Set an equal range on both sides of zero
									tickFormatter={(value) => Math.abs(value)} // Show absolute values
									label={{
										value: "ASR (World) per 100 000",
										position: "insideBottom",
										offset: -5,
									}}
								/>
								<YAxis dataKey="name" type="category" />
								<Tooltip formatter={(value) => Math.abs(value)} />
								<Legend />
								{viewBySex ? (
									<>
										<Bar
											dataKey="males"
											fill="#1f77b4"
											name="Males"
											barSize={20}
										/>{" "}
										{/* Adjust barSize to make it more prominent */}
										<Bar
											dataKey="females"
											fill="#ff7f0e"
											name="Females"
											barSize={20}
										/>
									</>
								) : (
									<Bar dataKey="cases" barSize={20}>
										{chartData.map((entry, index) => (
											<Cell
												key={`cell-${index}`}
												fill={colors[index % colors.length]}
											/>
										))}
									</Bar>
								)}
							</BarChart>
						</ResponsiveContainer>
					)}
					{chartType === "timeSeries" && (
						<ResponsiveContainer width="100%" height={400}>
							<LineChart data={timeSeriesData}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="year" />
								<YAxis />
								<Tooltip />
								<Legend />
								<Line type="monotone" dataKey="cases" stroke="#8884d8" />
							</LineChart>
						</ResponsiveContainer>
					)}
					{chartType === "ageDistribution" && (
						<ResponsiveContainer width="100%" height={400}>
							<BarChart
								data={ageDistributionData}
								layout="vertical"
								barCategoryGap="20%"
							>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis
									type="number"
									domain={[
										-Math.max(...ageDistributionData.map((d) => d.females)),
										Math.max(...ageDistributionData.map((d) => d.females)),
									]} // Symmetric domain for mirroring
									tickFormatter={(value) => Math.abs(value)} // Display counts as positive values
									label={{
										value: "Count",
										position: "insideBottom",
										offset: -5,
									}}
								/>
								<YAxis dataKey="ageGroup" type="category" />
								<Tooltip formatter={(value) => Math.abs(value)} />
								<Legend />
								<Bar
									dataKey="males"
									fill="#1f77b4"
									name="Males"
									barSize={20}
								/>{" "}
								{/* Males bar on the left */}
								<Bar
									dataKey="females"
									fill="#ff7f0e"
									name="Females"
									barSize={20}
								/>{" "}
								{/* Females bar on the right */}
							</BarChart>
						</ResponsiveContainer>
					)}

					{chartType === "pieChart" && (
						<ResponsiveContainer width="100%" height={400}>
							<PieChart>
								<Pie
									data={pieChartData}
									dataKey="value"
									nameKey="name"
									cx="50%"
									cy="50%"
									outerRadius={100}
									fill="#8884d8"
									label
								>
									{pieChartData.map((entry, index) => (
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
					{chartType === "heatMap" && (
						<ResponsiveContainer width="100%" height={400}>
							<ComposedChart data={heatMapData} layout="horizontal">
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="ageGroup" />
								<YAxis />
								<Tooltip />
								<Legend />
								<Bar dataKey="males" stackId="a" fill="#1f77b4" />
								<Bar dataKey="females" stackId="a" fill="#ff7f0e" />
							</ComposedChart>
						</ResponsiveContainer>
					)}
				</div>
			</div>
		</div>
	);
};

export default CancerRegistryDashboard;
