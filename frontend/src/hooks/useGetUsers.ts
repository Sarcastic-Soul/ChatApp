import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";
import { errorMessage } from "../utils/errorMessage";
import type { ApiError, PublicUser } from "../types";

const useGetUsers = () => {
	const [loading, setLoading] = useState(false);
	const [users, setUsers] = useState<PublicUser[]>([]);

	useEffect(() => {
		const getUsers = async () => {
			setLoading(true);
			try {
				const res = await fetch(`/api/users`);
				const data = (await res.json()) as PublicUser[] & ApiError;
				if (data.error) {
					throw new Error(data.error);
				}
				setUsers(data);
			} catch (error) {
				notifications.show({ message: errorMessage(error), color: "red" });
			} finally {
				setLoading(false);
			}
		};

		getUsers();
	}, []);

	return { loading, users };
};
export default useGetUsers;
