import { useState } from "react";
import { notifications } from "@mantine/notifications";
import useConversation from "../zustand/useConversation";

const useForwardMessage = () => {
    const [loading, setLoading] = useState(false);
    const { selectedConversation, addMessage } = useConversation();

    const forwardMessage = async (targetConversationId, originalMessage) => {
        setLoading(true);
        try {
            const body = {
                message: originalMessage.message,
                mediaUrl: originalMessage.mediaUrl,
                mediaType: originalMessage.mediaType,
                isForwarded: true
            };

            const res = await fetch(
                `/api/messages/send/${targetConversationId}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(body),
                    credentials: "include"
                }
            );

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to forward message");
            }
            notifications.show({ message: "Message forwarded", color: "green" });
            
            if (selectedConversation && (selectedConversation._id === targetConversationId || selectedConversation.participantId === targetConversationId)) {
                addMessage(data.newMessage);
            }
            return true;
        } catch (error) {
            console.error("Error forwarding message:", error.message);
            notifications.show({ message: error.message, color: "red" });
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { forwardMessage, loading };
};

export default useForwardMessage;
