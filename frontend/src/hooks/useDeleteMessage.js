import { useState } from "react";
import useConversation from "../zustand/useConversation";
import { notifications } from "@mantine/notifications";

const useDeleteMessage = () => {
    const [loading, setLoading] = useState(false);
    const { updateMessage } = useConversation();

    const deleteMessage = async (messageId) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/messages/delete/${messageId}`, {
                method: "DELETE",
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to delete message");
            }
            updateMessage(data);
            return true;
        } catch (error) {
            notifications.show({
                title: "Error",
                message: error.message,
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
