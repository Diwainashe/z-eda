import React from "react";
import { Container, Typography, Divider, Box } from "@mui/material";

const About = () => {
	return (
		<Container maxWidth="md" style={{ padding: "40px", lineHeight: 1.6 }}>
			<Typography
				variant="h4"
				component="h1"
				gutterBottom
				style={{ textAlign: "center", marginBottom: "20px" }}
			>
				About the Zimbabwe National Cancer Registry (ZNCR)
			</Typography>

			<Typography variant="body1" paragraph>
				The Zimbabwe National Cancer Registry (ZNCR) was founded in 1985 and
				began its activities in 1986. This was as a result of a collaborative
				research agreement (CRA) between the then Ministry of Health and Child
				Welfare (MOHCW) and the International Agency for Research on Cancer
				(IARC) of the World Health Organisation (WHO).
			</Typography>
			<Typography variant="body1" paragraph>
				Although the ZNCR was initially population-based for Harare City, it has
				expanded and is close to achieving full national coverage with the
				revival of the Bulawayo Cancer Registry (BCR) and data collection across
				provinces. The activities of the ZNCR are overseen by a
				multidisciplinary advisory committee.
			</Typography>
			<Typography variant="body1" paragraph>
				Located within the Parirenyatwa Group of Hospitals complex, a large
				tertiary hospital, ZNCR collaborates with the University of Zimbabwe
				College of Health Sciences (UZCHS). The Bulawayo branch operates within
				the Radiotherapy Department at Mpilo Central Hospital.
			</Typography>

			<Divider style={{ margin: "20px 0" }} />

			<Typography variant="body1" paragraph>
				ZNCR is a voting member of the International Association of Cancer
				Registries (IACR), the Union for International Cancer Control (UICC),
				and an active member of the African Cancer Registry Network (AFCRN). For
				over two decades, ZNCR has provided technical support to registries in
				sub-Saharan Africa, partnering with the WHO Regional Office for Africa,
				IARC, IAEA, UICC, and AFCRN.
			</Typography>

			<Typography variant="body1" paragraph>
				ZNCR’s accomplishments include contributing data to five volumes of the
				prestigious “Cancer Incidence in 5 Continents” series, two volumes of
				the “International Incidence of Childhood Cancer” monographs, and
				numerous high-impact publications in medical journals.
			</Typography>

			<Typography
				variant="h5"
				component="h2"
				gutterBottom
				style={{ marginTop: "30px", textAlign: "center" }}
			>
				How the ZNCR Dashboard Will Help Achieve Core Objectives
			</Typography>

			<Typography variant="body1" paragraph>
				The ZNCR dashboard will be instrumental in achieving its core
				objectives, offering a user-friendly platform for analyzing and
				visualizing cancer data across Zimbabwe.
			</Typography>

			<Box component="ul" style={{ paddingLeft: "20px" }}>
				<li>
					<Typography variant="body1">
						<strong>Data Consolidation:</strong> The dashboard will unify cancer
						data from Harare, Bulawayo, and other provinces, enabling easier
						monitoring of national trends.
					</Typography>
				</li>
				<li>
					<Typography variant="body1">
						<strong>Improved Decision-Making:</strong> Real-time insights and
						visualizations will empower stakeholders to make data-driven
						decisions regarding cancer prevention, treatment, and resource
						allocation.
					</Typography>
				</li>
				<li>
					<Typography variant="body1">
						<strong>Research Facilitation:</strong> Researchers will have
						streamlined access to cancer incidence, survival, and mortality
						data, enhancing ZNCR’s role in advancing global cancer knowledge.
					</Typography>
				</li>
				<li>
					<Typography variant="body1">
						<strong>Public Awareness:</strong> The dashboard will present key
						statistics and findings to the public in an accessible format,
						promoting cancer awareness and prevention efforts in Zimbabwe.
					</Typography>
				</li>
				<li>
					<Typography variant="body1">
						<strong>Policy Support:</strong> By providing comprehensive data,
						the dashboard will support policymakers in crafting cancer control
						strategies reflective of Zimbabwe’s current cancer burden.
					</Typography>
				</li>
			</Box>
		</Container>
	);
};

export default About;
