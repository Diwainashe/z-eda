import {
	AppBar,
	Toolbar,
	Typography,
	Button,
	Box,
	Menu,
	MenuItem,
} from "@mui/material";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const Navbar = () => {
	const router = useRouter();
	const [username, setUsername] = useState(null);

	// Dropdown state for EDA menu
	const [edaAnchorEl, setEdaAnchorEl] = useState(null);
	const isEdaMenuOpen = Boolean(edaAnchorEl);

	// Function to check if the route matches the current path
	const isActive = (path) => router.pathname === path;

	useEffect(() => {
		// Function to update username state
		const checkUsername = () => {
			const storedUsername = localStorage.getItem("username");
			if (storedUsername) {
				setUsername(storedUsername);
			} else {
				setUsername(null);
			}
		};

		// Check for username on component mount
		checkUsername();

		// Listen for route changes to update username
		router.events.on("routeChangeComplete", checkUsername);

		// Cleanup listener on component unmount
		return () => {
			router.events.off("routeChangeComplete", checkUsername);
		};
	}, [router.events]);

	const handleNavigation = (path) => {
		router.push(path);
	};

	const handleLogout = () => {
		localStorage.removeItem("username");
		localStorage.removeItem("token"); // Also remove the token
		setUsername(null);
		router.push("/login");
	};

	// Open and close functions for EDA dropdown menu
	const handleEdaMenuOpen = (event) => {
		setEdaAnchorEl(event.currentTarget);
	};

	const handleEdaMenuClose = () => {
		setEdaAnchorEl(null);
	};

	return (
		<AppBar position="fixed" style={{ backgroundColor: "#F5F5F5" }}>
			<Toolbar style={{ display: "flex", justifyContent: "space-between" }}>
				<Typography variant="h3" style={{ color: "#1CABE2" }}>
					Z-eda
				</Typography>
				<Box style={{ display: "flex", gap: "40px" }}>
					<Button
						onClick={() => handleNavigation("/")}
						style={{
							color: "#333",
							fontSize: "25px",
							textDecoration: isActive("/") ? "underline" : "none", // Apply underline if active
						}}
					>
						Home
					</Button>
					<Button
						onClick={() => handleNavigation("/about")}
						style={{
							color: "#333",
							fontSize: "25px",
							textDecoration: isActive("/about") ? "underline" : "none",
						}}
					>
						About
					</Button>
					<Button
						onClick={() => handleNavigation("/populationFactSheet")}
						style={{
							color: "#333",
							fontSize: "25px",
							textDecoration: isActive("/populationFactSheet")
								? "underline"
								: "none",
						}}
					>
						Population Factsheets
					</Button>
					<Button
						onClick={() => handleNavigation("/cancerFactSheet")}
						style={{
							color: "#333",
							fontSize: "25px",
							textDecoration: isActive("/cancerFactSheet")
								? "underline"
								: "none",
						}}
					>
						Cancer Factsheets
					</Button>
					<Button
						onClick={() => handleNavigation("/dataviz")}
						style={{
							color: "#333",
							fontSize: "25px",
							textDecoration: isActive("/dataviz") ? "underline" : "none",
						}}
					>
						DataViz
					</Button>

					{/* EDA Button with Dropdown */}
					<Button
						onClick={handleEdaMenuOpen}
						style={{
							color: "#333",
							fontSize: "25px",
							textDecoration: isActive("/Eda") ? "underline" : "none",
						}}
					>
						EDA
					</Button>
					<Menu
						anchorEl={edaAnchorEl}
						open={isEdaMenuOpen}
						onClose={handleEdaMenuClose}
						anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
					>
						<MenuItem
							onClick={() => {
								handleNavigation("/Eda");
								handleEdaMenuClose();
							}}
						>
							Add Incidence Data
						</MenuItem>
						<MenuItem
							onClick={() => {
								handleNavigation("/databaseSchema");
								handleEdaMenuClose();
							}}
						>
							View Database Schema
						</MenuItem>
						<MenuItem
							onClick={() => {
								handleNavigation("/stratifiedData");
								handleEdaMenuClose();
							}}
						>
							View Stratified Data
						</MenuItem>
					</Menu>

					{username ? (
						<Button
							onClick={handleLogout}
							style={{ color: "#333", fontSize: "25px" }}
						>
							Logout: {username}
						</Button>
					) : (
						<Button
							onClick={() => handleNavigation("/login")}
							style={{
								color: "#333",
								fontSize: "25px",
								textDecoration: isActive("/login") ? "underline" : "none",
							}}
						>
							Login
						</Button>
					)}
				</Box>
			</Toolbar>
		</AppBar>
	);
};

export default Navbar;
