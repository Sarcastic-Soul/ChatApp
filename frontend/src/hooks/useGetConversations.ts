import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";
import useConversation from "../zustand/useConversation";
import { errorMessage } from "../utils/errorMessage";
import { openMessage } from "../utils/e2ee/chats";
import { getCachedChats, setCachedChats } from "../utils/messageCacheDB";
import type { ApiError, Conversation, Message } from "../types";

const useGetConversations = () => {
	const [loading, setLoading] = useState(false);
	const { setConversations } = useConversation();

	useEffect(() => {
		const getConversations = async () => {
			setLoading(true);

			// The saved list shows at once; the network copy replaces it
			const cached = await getCachedChats().catch(() => []);
			if (cached.length && useConversation.getState().conversations.length === 0) {
				setConversations(cached);
				setLoading(false);
			}

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

				// End-to-end previews arrive as ciphertext. With a saved list
				// on screen they are decrypted first; otherwise the list shows
				// right away and the previews fill in.
				const openPreviews = () =>
					Promise.all(
						data.map(async (conv) =>
							conv.lastMessage?.e2ee
								? { ...conv, lastMessage: await openMessage(conv.lastMessage as Message) }
								: conv,
						),
					);
				if (!cached.length) setConversations(data);
				const opened = await openPreviews();
				setConversations(opened);
				void setCachedChats(opened).catch(() => undefined);
			} catch (error) {
				console.error('Error fetching conversations:', error);
				// Offline with a saved list: nothing to complain about
				if (!cached.length || navigator.onLine) {
					notifications.show({ message: errorMessage(error), color: "red" });
				}
			} finally {
				setLoading(false);
			}
		};

		getConversations();
	}, [setConversations]);

	return { loading };
};
export default useGetConversations;
