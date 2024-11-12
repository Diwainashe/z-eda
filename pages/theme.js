// theme.js
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
	palette: {
		primary: {
			main: "#007bc8", // UNICEF Blue
		},
		secondary: {
			main: "#ff5722", // Example secondary color
		},
	},
	typography: {
		h6: {
			fontSize: "1.8rem",
			fontWeight: "bold",
		},
	},
});

export default theme;
