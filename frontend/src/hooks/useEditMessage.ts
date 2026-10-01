import { useState } from "react";
import useConversation from "../zustand/useConversation";
import { notifications } from "@mantine/notifications";
import { errorMessage } from "../utils/errorMessage";
import type { ApiError, Message } from "../types";

const useEditMessage = () => {
    const [loading, setLoading] = useState(false);
    const { updateMessage } = useConversation();

    const editMessage = async (messageId: string, newText: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/messages/edit/${messageId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ message: newText }),
                credentials: "include",
            });
            const data = (await res.json()) as Message & ApiError;
            if (!res.ok) {
                throw new Error(data.error || "Failed to edit message");
            }
            updateMessage(data);
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
