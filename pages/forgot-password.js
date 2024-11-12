// pages/forgot-password.js

import { useState } from "react";
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

export default function ForgotPassword() {
	const [username, setUsername] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(null);
	const [error, setError] = useState(null);

	const handleResetRequest = async () => {
		setLoading(true);
		setError(null);
		setSuccess(null);
		try {
			await apiRequest("auth/forgot-password/", "POST", {
				username,
				new_password: newPassword, // Send new password with the request
			});
			setSuccess("Password reset requested. Await admin approval.");
		} catch (err) {
			setError("User not found or error in processing request.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Container maxWidth="xs">
			<Paper elevation={6} style={{ padding: "2rem", marginTop: "5rem" }}>
				<Typography
					variant="h5"
					align="center"
					gutterBottom
					style={{ color: "#1CABE2" }}
				>
					Forgot Password
				</Typography>
				<Box mb={2}>
					<TextField
						label="Username or Email"
						variant="outlined"
						fullWidth
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						required
					/>
				</Box>
				<Box mb={2}>
					<TextField
						label="New Password"
						variant="outlined"
						type="password"
						fullWidth
						value={newPassword}
						onChange={(e) => setNewPassword(e.target.value)}
						required
					/>
				</Box>
				{error && (
					<Box mb={2}>
						<Alert severity="error">{error}</Alert>
					</Box>
				)}
				{success && (
					<Box mb={2}>
						<Alert severity="success">{success}</Alert>
					</Box>
				)}
				<Button
					variant="contained"
					color="primary"
					fullWidth
					onClick={handleResetRequest}
					disabled={loading}
					style={{ padding: "0.75rem" }}
				>
					{loading ? (
						<CircularProgress size={24} color="inherit" />
					) : (
						"Request Reset"
					)}
				</Button>
			</Paper>
		</Container>
	);
}
