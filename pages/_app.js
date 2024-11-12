// src/pages/_app.js
import React from "react";
import Layout from "../components/Layout";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./theme";
import withAuth from "./hoc/withAuth"; // Ensure this file is correctly set up
import withAdminAuth from "./hoc/withAdminAuth";

function MyApp({ Component, pageProps }) {
	let ProtectedComponent = Component;

	// Apply general auth check if `protected` flag is set
	if (Component.protected) {
		ProtectedComponent = withAuth(Component);
	}

	// Apply admin auth check if `adminProtected` flag is set
	if (Component.adminProtected) {
		ProtectedComponent = withAdminAuth(Component);
	}
	return (
		<React.StrictMode>
			<ThemeProvider theme={theme}>
				<CssBaseline />
				<Layout>
					<ProtectedComponent {...pageProps} />
				</Layout>
			</ThemeProvider>
		</React.StrictMode>
	);
}

export default MyApp;
