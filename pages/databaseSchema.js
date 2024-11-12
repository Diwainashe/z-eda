// pages/databaseSchema.js

import { useEffect, useState } from "react";
import { apiRequest } from "./utils/api";

DatabaseSchema.adminProtected = true;
export default function DatabaseSchema() {
	const [schema, setSchema] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const fetchSchema = async () => {
			try {
				// Use the `apiRequest` function to make the GET request
				const data = await apiRequest("database-schema/", "GET");
				setSchema(data);
			} catch (error) {
				setError(error.message || "Failed to load schema data");
			} finally {
				setLoading(false);
			}
		};
		fetchSchema();
	}, []);

	if (loading) return <p>Loading...</p>;
	if (error) return <p>Error: {error}</p>;

	return (
		<div>
			<h1>Database Schema</h1>
			{schema.map((model) => (
				<div key={model.model_name}>
					<h2>
						{model.app_label}.{model.model_name}
					</h2>
					<table border="1" cellPadding="8">
						<thead>
							<tr>
								<th>Field Name</th>
								<th>Field Type</th>
								<th>Nullable</th>
								<th>Related Model</th>
							</tr>
						</thead>
						<tbody>
							{model.fields.map((field) => (
								<tr key={field.name}>
									<td>{field.name}</td>
									<td>{field.type}</td>
									<td>{field.nullable ? "Yes" : "No"}</td>
									<td>{field.related_model || "N/A"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			))}
		</div>
	);
}
