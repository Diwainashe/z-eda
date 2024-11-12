// components/Header.js
import React from "react";

const Header = () => {
	const containerStyle = {
		display: "flex", // Use flexbox for layout
		justifyContent: "space-around", // Distribute items evenly
		alignItems: "center", // Center items vertically
		padding: "10px 0",
		backgroundColor: "#f8f9fa",
	};
	return (
		<div style={containerStyle}>
			<img
				src="/gicr.jpg" // Ensure the path is correct
				// alt="GICR"
				width="628"
				style={{ margin: "0 20px" }} // Spacing around logos
			/>
			<img
				src="/zeda.png" // Ensure the path is correct
				// alt="Zeda"
				width="499"
				style={{ margin: "0 20px" }} // Spacing around logos
			/>
		</div>
	);
};

export default Header;
