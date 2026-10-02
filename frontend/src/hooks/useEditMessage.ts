import { useState } from "react";
import useConversation from "../zustand/useConversation";
import { notifications } from "@mantine/notifications";
import { errorMessage } from "../utils/errorMessage";
import { openMessage, sendSealed } from "../utils/e2ee/chats";
import type { ApiError, Message } from "../types";

const useEditMessage = () => {
    const [loading, setLoading] = useState(false);
    const { updateMessage } = useConversation();

    const editMessage = async (original: Message, newText: string) => {
        setLoading(true);
        try {
            // Encrypted like a new message when the chat is end to end
            const res = await sendSealed(original.receiverId, newText, (fields) =>
                fetch(`/api/messages/edit/${original._id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(fields),
                    credentials: "include",
                }),
            );
            const data = (await res.json()) as Message & ApiError;
            if (!res.ok) {
                throw new Error(data.error || "Failed to edit message");
            }
            updateMessage(await openMessage(data));
            return true;
        } catch (error) {
            notifications.show({
                title: "Error",
                message: errorMessage(error),
                color: "red",
            });
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { editMessage, loading };
};

export default useEditMessage;
