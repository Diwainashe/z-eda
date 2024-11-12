import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { apiRequest } from "../utils/api";

const withAdminAuth = (Component) => {
	return (props) => {
		const router = useRouter();
		const [isAuthenticated, setIsAuthenticated] = useState(false);

		useEffect(() => {
			const checkAuth = async () => {
				try {
					const response = await apiRequest("auth/check/", "GET");
					if (response.authenticated && response.is_staff) {
						setIsAuthenticated(true);
					} else {
						router.push("/login");
					}
				} catch (error) {
					router.push("/login");
				}
			};
			checkAuth();
		}, []);

		if (!isAuthenticated) {
			return <p>Loading...</p>;
		}

		return <Component {...props} />;
	};
};

export default withAdminAuth;
