import { useState } from "react";
import { notifications } from "@mantine/notifications";
import useConversation from "../zustand/useConversation";
import { errorMessage } from "../utils/errorMessage";
import { openMessage, sendSealed } from "../utils/e2ee/chats";
import { mediaForChat } from "../utils/e2ee/media";
import type { ApiError, Message } from "../types";

const useForwardMessage = () => {
    const [loading, setLoading] = useState(false);
    const { selectedConversation, addMessage } = useConversation();

    const forwardMessage = async (targetConversationId: string, originalMessage: Message) => {
        setLoading(true);
        try {
            // An attachment keeps its key between encrypted chats, and is
            // encrypted or decrypted first when the two chats differ
            const media = await mediaForChat(targetConversationId, originalMessage);
            const body = {
                mediaUrl: media?.url ?? null,
                mediaType: originalMessage.mediaType,
                isForwarded: true
            };

            // Decrypted here, so it's encrypted again for the other chat
            const res = await sendSealed(targetConversationId, originalMessage.message, (fields) =>
                fetch(`/api/messages/send/${targetConversationId}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ ...body, ...fields }),
                    credentials: "include",
                }),
                media?.secret,
            );

            const data = (await res.json()) as { newMessage: Message } & ApiError;
            if (!res.ok) {
                throw new Error(data.error || "Failed to forward message");
            }
            notifications.show({ message: "Message forwarded", color: "green" });
            
            if (selectedConversation && (selectedConversation._id === targetConversationId || selectedConversation.participantId === targetConversationId)) {
                addMessage(await openMessage(data.newMessage));
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
