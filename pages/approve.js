// pages/approve/[userId].js
import { useState } from "react";
import { useRouter } from "next/router";
import {
	TextField,
	Button,
	Box,
	Typography,
	Alert,
	Container,
	Paper,
} from "@mui/material";
import { apiRequest } from "../utils/api"; // Adjust the path as necessary

const ApproveUser = () => {
	const router = useRouter();
	const { userId } = router.query;
	const [otpCode, setOtpCode] = useState("");
	const [error, setError] = useState(null);
	const [successMessage, setSuccessMessage] = useState(null);

	const handleApproval = async () => {
		try {
			const response = await apiRequest(`approve/${userId}/`, "POST", {
				otp_code: otpCode,
			});
			setSuccessMessage("User approved successfully.");
		} catch (err) {
			setError("Invalid OTP code or failed to approve.");
		}
	};

	return (
		<Container maxWidth="xs">
			<Paper elevation={6} style={{ padding: "2rem", marginTop: "5rem" }}>
				<Typography variant="h5" align="center" gutterBottom>
					Enter 2FA Code to Approve User
				</Typography>
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
				<Box mb={2}>
					<TextField
						label="2FA Code"
						variant="outlined"
						fullWidth
						value={otpCode}
						onChange={(e) => setOtpCode(e.target.value)}
						required
					/>
				</Box>
				<Button
					variant="contained"
					color="primary"
					fullWidth
					onClick={handleApproval}
				>
					Approve User
				</Button>
			</Paper>
		</Container>
	);
};

export default ApproveUser;
