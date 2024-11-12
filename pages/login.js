// pages/login.js

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

export default function Login() {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	// Define the setTokens function to store tokens
	const setTokens = (accessToken, refreshToken) => {
		localStorage.setItem("accessToken", accessToken);
		localStorage.setItem("refreshToken", refreshToken);
	};

	const handleLogin = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError(null);

		try {
			const data = await apiRequest("auth/login/", "POST", {
				username,
				password,
			});

			// Check if tokens are in the response
			if (data.access && data.refresh) {
				setTokens(data.access, data.refresh); // Store tokens
				localStorage.setItem("username", username);
				router.push("/home"); // Redirect after successful login
			} else {
				setError("Login failed: Tokens not received");
			}
		} catch (err) {
			setError("Invalid credentials");
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
					Login
				</Typography>
				<form onSubmit={handleLogin} noValidate>
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
							label="Password"
							variant="outlined"
							type="password"
							fullWidth
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							autoComplete="current-password"
						/>
					</Box>
					{error && (
						<Box mb={2}>
							<Alert severity="error">{error}</Alert>
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
						{loading ? <CircularProgress size={24} color="inherit" /> : "Login"}
					</Button>
				</form>
				<Typography
					variant="body2"
					align="center"
					color="textSecondary"
					style={{ marginTop: "1rem" }}
				>
					Don't have an account?{" "}
					<Button color="primary" onClick={() => router.push("/register")}>
						Register
					</Button>
				</Typography>
				<Typography
					variant="body2"
					align="center"
					color="textSecondary"
					style={{ marginTop: "1rem" }}
				>
					Forgot your password?{" "}
					<Button
						color="primary"
						onClick={() => router.push("/forgot-password")}
					>
						Reset Password
					</Button>
				</Typography>
			</Paper>
		</Container>
	);
}
