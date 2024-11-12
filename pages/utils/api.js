// src/utils/api.js

// Function to get the stored access token from localStorage
const getAccessToken = () => localStorage.getItem("accessToken");

// Function to store new tokens in localStorage
const setTokens = (access, refresh) => {
	localStorage.setItem("accessToken", access);
	if (refresh) {
		localStorage.setItem("refreshToken", refresh);
	}
};

// Function to fetch a new access token using the refresh token
const refreshAccessToken = async () => {
	const refreshToken = localStorage.getItem("refreshToken");
	if (!refreshToken) return null;

	const response = await fetch(
		`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/refresh/`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refresh: refreshToken }),
		}
	);

	if (!response.ok) {
		// Clear stored tokens if the refresh token is expired
		localStorage.removeItem("accessToken");
		localStorage.removeItem("refreshToken");
		throw new Error("Session expired. Please log in again.");
	}

	const data = await response.json();
	setTokens(data.access, data.refresh);
	return data.access;
};

// Main API request function
export const apiRequest = async (endpoint, method = "GET", data = null) => {
	const headers = { "Content-Type": "application/json" };
	let accessToken = getAccessToken();

	// Include the Authorization header if an access token is available
	if (accessToken) {
		headers["Authorization"] = `Bearer ${accessToken}`;
	}

	let body = null;
	if (data) {
		if (data instanceof FormData) {
			body = data;
			delete headers["Content-Type"]; // Let the browser handle FormData headers
		} else {
			body = JSON.stringify(data);
		}
	}

	const config = {
		method,
		headers,
		credentials: "include",
		body: method === "GET" || method === "HEAD" ? undefined : body,
	};

	try {
		let response = await fetch(
			`${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}`,
			config
		);

		console.log("Authorization header:", headers["Authorization"]); // Debugging header check

		// Handle 401 Unauthorized by refreshing the token
		if (response.status === 401) {
			try {
				// Refresh the access token
				accessToken = await refreshAccessToken();
				if (accessToken) {
					// Update the headers with the new access token and retry
					headers["Authorization"] = `Bearer ${accessToken}`;
					config.headers = headers; // Explicitly reassign headers
					response = await fetch(
						`${process.env.NEXT_PUBLIC_API_BASE_URL}${endpoint}`,
						config
					);
				}
			} catch (refreshError) {
				console.error("Token refresh failed:", refreshError);
				throw new Error("Authentication required. Please log in.");
			}
		}

		// Process response based on content type
		const contentType = response.headers.get("content-type");
		const isJsonResponse =
			contentType && contentType.includes("application/json");
		const responseData = isJsonResponse ? await response.json() : null;

		if (!response.ok) {
			const error = new Error(responseData?.error || "API request failed");
			error.status = response.status;
			throw error;
		}

		return responseData;
	} catch (error) {
		throw error; // Re-throw error for handling in the calling component
	}
};
