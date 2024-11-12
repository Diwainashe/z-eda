import React, { useEffect } from "react";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import "@react-pdf-viewer/core/lib/styles/index.css";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

// Set the workerSrc to use the CDN or local path if bundled
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

const cancerFactSheet = () => {
	useEffect(() => {
		pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js"; // Ensure this is set in a useEffect
	}, []);
	return (
		<div style={{ height: "100vh", width: "100%" }}>
			<Worker workerUrl="/pdf.worker.min.js">
				<Viewer fileUrl="/cancers-fact-sheet.pdf" />
			</Worker>
		</div>
	);
};

export default cancerFactSheet;
