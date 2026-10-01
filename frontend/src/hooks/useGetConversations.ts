import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";
import useConversation from "../zustand/useConversation";
import { errorMessage } from "../utils/errorMessage";
import type { ApiError, Conversation } from "../types";

const useGetConversations = () => {
	const [loading, setLoading] = useState(false);
	const { setConversations } = useConversation();

	useEffect(() => {
		const getConversations = async () => {
			setLoading(true);
			try {
				const res = await fetch(`/api/users/conversations`, {
					credentials: 'include',
					method: 'GET',
					headers: {
						'Content-Type': 'application/json',
					},
				});

				if (!res.ok) {
					throw new Error(`HTTP error! status: ${res.status}`);
				}

				const data = (await res.json()) as Conversation[] & ApiError;
				if (data.error) {
					throw new Error(data.error);
				}
				setConversations(data);
			} catch (error) {
				console.error('Error fetching conversations:', error);
				notifications.show({ message: errorMessage(error), color: "red" });
			} finally {
				setLoading(false);
			}
		};

		getConversations();
	}, [setConversations]);

	return { loading };
};
export default useGetConversations;