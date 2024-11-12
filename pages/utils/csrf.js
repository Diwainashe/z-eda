// src/utils/csrf.js

// Fetch CSRF token before logging in
const getCSRFToken = async () => {
	await fetch("http://localhost:8000/auth/csrf/", {
		method: "GET",
		credentials: "include",
	});
};
