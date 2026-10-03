import { useState } from "react";
import useConversation, { placeMessage } from "../zustand/useConversation";
import { notifications } from "@mantine/notifications";
import { useAuthContext } from "../context/AuthContext";
import { errorMessage } from "../utils/errorMessage";
import { addToOutbox } from "../utils/messageCacheDB";
import { flushOutbox } from "../utils/outbox";
import { senderIdOf } from "../utils/sender";
import type { MediaSecret, MediaType, Message } from "../types";

export interface MediaAttachment {
    url: string;
    type: MediaType;
    // Set when the file was encrypted before upload
    secret?: MediaSecret;
}

interface SendMessageBody {
    message: string;
    clientId: string;
    replyTo?: string;
    mediaUrl?: string;
    mediaType?: MediaType;
    // Never sent as it is: the outbox encrypts it into the message
    mediaSecret?: MediaSecret;
}

// The message shows in the chat straight away, marked as sending. It waits
// in the outbox (utils/outbox.ts) until the server has saved it.
const useSendMessage = () => {
    const [loading, setLoading] = useState(false);
    const { authUser } = useAuthContext();
    const { setMessages, selectedConversation, replyingToMessage, setReplyingToMessage } =
        useConversation();

    const sendMessage = async (messageText = "", media: MediaAttachment | null = null) => {
        if (!selectedConversation || !authUser) return;
        setLoading(true);
        try {
            const clientId = crypto.randomUUID();
            const body: SendMessageBody = { message: messageText, clientId };

            if (replyingToMessage) {
                body.replyTo = replyingToMessage._id;
            }

            if (media && media.url && media.type) {
                body.mediaUrl = media.url;
                body.mediaType = media.type;
                if (media.secret) body.mediaSecret = media.secret;
            }

            const now = new Date().toISOString();
            const message: Message = {
                _id: clientId,
                clientId,
                pending: true,
                senderId: authUser,
                receiverId: selectedConversation._id,
                message: messageText,
                mediaUrl: body.mediaUrl ?? null,
                mediaType: body.mediaType ?? "text",
                media: body.mediaSecret,
                status: "sent",
                isEdited: false,
                isDeleted: false,
                isCall: false,
                isForwarded: false,
                isSystem: false,
                replyTo: replyingToMessage
                    ? {
                          _id: replyingToMessage._id,
                          message: replyingToMessage.message,
                          mediaType: replyingToMessage.mediaType,
                          mediaUrl: replyingToMessage.mediaUrl,
                          senderId: senderIdOf(replyingToMessage.senderId),
                      }
                    : null,
                reactions: [],
                createdAt: now,
                updatedAt: now,
            };

            await addToOutbox({
                clientId,
                targetId: selectedConversation._id,
                body: { ...body },
                message,
                createdAt: Date.now(),
            });
            setMessages((prev) => placeMessage(prev, message));
            setReplyingToMessage(null);

            void flushOutbox(authUser._id);
        } catch (error) {
            console.error("Error sending message:", errorMessage(error));
            notifications.show({ message: errorMessage(error), color: "red" });
        } finally {
            setLoading(false);
        }
    };

    return { sendMessage, loading };
};

export default useSendMessage;
