import { useState } from "react";
import useConversation from "../zustand/useConversation";
import { notifications } from "@mantine/notifications";
import { errorMessage } from "../utils/errorMessage";
import type { ApiError, Message } from "../types";

const useDeleteMessage = () => {
    const [loading, setLoading] = useState(false);
    const updateMessage = useConversation((state) => state.updateMessage);

    const deleteMessage = async (messageId: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/messages/delete/${messageId}`, {
                method: "DELETE",
                credentials: "include",
            });
            const data = (await res.json()) as Message & ApiError;
            if (!res.ok) {
                throw new Error(data.error || "Failed to delete message");
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

    return { deleteMessage, loading };
};

export default useDeleteMessage;
