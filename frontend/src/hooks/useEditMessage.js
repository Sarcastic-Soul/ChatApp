import { useState } from "react";
import useConversation from "../zustand/useConversation";
import { notifications } from "@mantine/notifications";

const useEditMessage = () => {
    const [loading, setLoading] = useState(false);
    const { updateMessage } = useConversation();

    const editMessage = async (messageId, newText) => {
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
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to edit message");
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

    return { editMessage, loading };
};

export default useEditMessage;
