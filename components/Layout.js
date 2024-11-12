//Layout.js
import React from "react";
import Navbar from "./Navbar";
import Header from "./Header";
const Layout = ({ children }) => {
	const navbarHeight = 40; // Example: set the navbar height in pixels

	const mainStyle = {
		paddingTop: `${navbarHeight}px`, // Ensure content is pushed down by navbar height
		padding: "80px", // Additional padding for content
	};

	return (
		<>
			<Navbar />
			<div>
				<main style={mainStyle}>{children}</main>
			</div>

			<footer style={footerStyles}>
				<Header />© 1985 - {new Date().getFullYear()} Zimbabwe National Cancer
				Registry. All rights reserved.
			</footer>
		</>
	);
};

// Inline styles for the footer (can also be moved to a CSS module or styled-components)
const footerStyles = {
	textAlign: "center",
	padding: "20px",
	backgroundColor: "#f8f9fa",
	position: "relative", // You can change to 'fixed' if you want a sticky footer
	bottom: 0,
	width: "100%",
	borderTop: "1px solid #ddd",
};

export default Layout;
