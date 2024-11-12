// pages/register.js

import { useState } from "react";
import { useRouter } from "next/router";
import { apiRequest } from "./utils/api";
import {
	TextField,
	Button,
	Box,
	Typography,
	Alert,
	Container,
	Paper,
	CircularProgress,
} from "@mui/material";

export default function Register() {
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);
	const [successMessage, setSuccessMessage] = useState(null);
	const router = useRouter();

	const handleRegister = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setSuccessMessage(null);

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			setLoading(false);
			return;
		}

		try {
			const response = await apiRequest("register/", "POST", {
				username,
				email,
				password,
			});
			setSuccessMessage(response.message);
		} catch (err) {
			setError("Failed to register. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Container maxWidth="xs">
			<Paper elevation={6} style={{ padding: "2rem", marginTop: "5rem" }}>
				<Typography
					variant="h4"
					align="center"
					gutterBottom
					style={{ color: "#1CABE2" }}
				>
					Register
				</Typography>
				<form onSubmit={handleRegister} noValidate>
					<Box mb={2}>
						<TextField
							label="Username"
							variant="outlined"
							fullWidth
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							required
							autoComplete="username"
						/>
					</Box>
					<Box mb={2}>
						<TextField
							label="Email"
							variant="outlined"
							type="email"
							fullWidth
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							autoComplete="email"
						/>
					</Box>
					<Box mb={2}>
						<TextField
							label="Password"
							variant="outlined"
							type="password"
							fullWidth
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							autoComplete="new-password"
						/>
					</Box>
					<Box mb={2}>
						<TextField
							label="Confirm Password"
							variant="outlined"
							type="password"
							fullWidth
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							required
							autoComplete="new-password"
						/>
					</Box>
					{error && (
						<Box mb={2}>
							<Alert severity="error">{error}</Alert>
						</Box>
					)}
					{successMessage && (
						<Box mb={2}>
							<Alert severity="success">{successMessage}</Alert>
						</Box>
					)}
					<Button
						type="submit"
						variant="contained"
						color="primary"
						fullWidth
						disabled={loading}
						style={{ padding: "0.75rem" }}
					>
						{loading ? (
							<CircularProgress size={24} color="inherit" />
						) : (
							"Register"
						)}
					</Button>
				</form>
			</Paper>
		</Container>
	);
}
