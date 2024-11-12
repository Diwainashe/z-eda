import React, { useState, useEffect } from "react";
import {
	Container,
	Typography,
	Checkbox,
	Button,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Paper,
} from "@mui/material";
import { apiRequest } from "./utils/api";

const AdminPage = () => {
	const [users, setUsers] = useState([]);

	useEffect(() => {
		const fetchUsers = async () => {
			try {
				const response = await apiRequest("api/manage-users/", "GET");

				if (response) {
					console.log("Fetched users:", response); // Log to verify data format
					setUsers(response);
				} else {
					console.error("No data received from API.");
				}
			} catch (error) {
				console.error("Error fetching users:", error);
			}
		};
		fetchUsers();
	}, []);

	const handlePrivilegeChange = (userId, field) => {
		setUsers((prevUsers) =>
			prevUsers.map((user) =>
				user.id === userId ? { ...user, [field]: !user[field] } : user
			)
		);
	};

	const handleSaveChanges = async (user) => {
		try {
			await apiRequest("admin/manage-users/", "POST", {
				user_id: user.id,
				is_active: user.is_active,
				is_staff: user.is_staff,
				is_superuser: user.is_superuser,
			});
			alert("User privileges updated successfully!");
		} catch (error) {
			console.error("Error updating user privileges:", error);
			alert("Failed to update user privileges.");
		}
	};

	return (
		<Container maxWidth="md">
			<Typography variant="h4" align="center" gutterBottom>
				User Management
			</Typography>
			<TableContainer component={Paper}>
				<Table>
					<TableHead>
						<TableRow>
							<TableCell>Username</TableCell>
							<TableCell>Email</TableCell>
							<TableCell align="center">Active</TableCell>
							<TableCell align="center">Staff</TableCell>
							<TableCell align="center">Superuser</TableCell>
							<TableCell align="center">Actions</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{users.map((user) => (
							<TableRow key={user.id}>
								<TableCell>{user.username}</TableCell>
								<TableCell>{user.email}</TableCell>
								<TableCell align="center">
									<Checkbox
										checked={user.is_active}
										onChange={() => handlePrivilegeChange(user.id, "is_active")}
									/>
								</TableCell>
								<TableCell align="center">
									<Checkbox
										checked={user.is_staff}
										onChange={() => handlePrivilegeChange(user.id, "is_staff")}
									/>
								</TableCell>
								<TableCell align="center">
									<Checkbox
										checked={user.is_superuser}
										onChange={() =>
											handlePrivilegeChange(user.id, "is_superuser")
										}
									/>
								</TableCell>
								<TableCell align="center">
									<Button
										variant="contained"
										color="primary"
										onClick={() => handleSaveChanges(user)}
									>
										Save
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
		</Container>
	);
};

AdminPage.adminProtected = true;

export default AdminPage;
