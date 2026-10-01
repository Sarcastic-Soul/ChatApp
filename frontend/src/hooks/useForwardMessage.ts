import { useState } from "react";
import { notifications } from "@mantine/notifications";
import useConversation from "../zustand/useConversation";
import { errorMessage } from "../utils/errorMessage";
import type { ApiError, Message } from "../types";

const useForwardMessage = () => {
    const [loading, setLoading] = useState(false);
    const { selectedConversation, addMessage } = useConversation();

    const forwardMessage = async (targetConversationId: string, originalMessage: Message) => {
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

            const data = (await res.json()) as { newMessage: Message } & ApiError;
            if (!res.ok) {
                throw new Error(data.error || "Failed to forward message");
            }
            notifications.show({ message: "Message forwarded", color: "green" });
            
            if (selectedConversation && (selectedConversation._id === targetConversationId || selectedConversation.participantId === targetConversationId)) {
                addMessage(data.newMessage);
            }
            return true;
        } catch (error) {
            console.error("Error forwarding message:", errorMessage(error));
            notifications.show({ message: errorMessage(error), color: "red" });
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { forwardMessage, loading };
};

export default useForwardMessage;
