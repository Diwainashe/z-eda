import React from "react";
import {
	Card,
	CardActionArea,
	CardContent,
	Typography,
	Grid,
	Container,
} from "@mui/material";
import { useRouter } from "next/router";

const Home = () => {
	const router = useRouter();

	// Define the pages you want to display as cards
	const pages = [
		{ title: "Home", route: "/" },
		{ title: "About", route: "/about" },
		{ title: "Population Factsheets", route: "/populationFactSheet" },
		{ title: "Cancer Factsheets", route: "/cancerFactSheet" },
		{ title: "DataViz", route: "/dataviz" },
	];

	// Inline styles for various components
	const styles = {
		pageContainer: {
			padding: "40px",
			backgroundColor: "#f5f5f5",
			minHeight: "100vh",
		},
		title: {
			marginBottom: "20px",
			textAlign: "center",
		},
		card: {
			width: "100%",
			height: "100%",
			backgroundColor: "#ffffff",
			boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
			borderRadius: "8px",
		},
		cardContent: {
			textAlign: "center",
			padding: "20px",
		},
		cardTitle: {
			fontSize: "1.25rem",
			color: "#333",
		},
		gridContainer: {
			display: "flex",
			justifyContent: "center",
			marginTop: "20px",
		},
	};

	return (
		<Container style={styles.pageContainer}>
			<Typography variant="h3" style={styles.title}>
				Welcome to the Dashboard
			</Typography>
			<Grid container spacing={4} style={styles.gridContainer}>
				{pages.map((page, index) => (
					<Grid item xs={12} sm={6} md={4} key={index}>
						<Card style={styles.card}>
							<CardActionArea onClick={() => router.push(page.route)}>
								<CardContent style={styles.cardContent}>
									<Typography variant="h5" style={styles.cardTitle}>
										{page.title}
									</Typography>
								</CardContent>
							</CardActionArea>
						</Card>
					</Grid>
				))}
			</Grid>
		</Container>
	);
};

export default Home;
