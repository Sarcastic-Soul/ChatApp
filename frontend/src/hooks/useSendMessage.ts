import { useState } from "react";
import useConversation from "../zustand/useConversation";
import { notifications } from "@mantine/notifications";
import { useAuthContext } from "../context/AuthContext";
import { errorMessage } from "../utils/errorMessage";
import type { ApiError, Conversation, MediaType, Message, PublicUser } from "../types";

export interface MediaAttachment {
    url: string;
    type: MediaType;
}

interface SendMessageBody {
    message: string;
    replyTo?: string;
    mediaUrl?: string;
    mediaType?: MediaType;
}

// The first message to someone also creates the conversation
interface SendMessageResponse extends ApiError {
    newMessage: Message;
    newConversation?: { _id: string; participants: PublicUser[] };
}

const useSendMessage = () => {
    const [loading, setLoading] = useState(false);
    const { authUser } = useAuthContext();
    const {
        messages,
        setMessages,
        selectedConversation,
        setConversations,
        conversations,
        setSelectedConversation,
        updateConversation,
        replyingToMessage,
        setReplyingToMessage,
    } = useConversation();

    const sendMessage = async (messageText = "", media: MediaAttachment | null = null) => {
        if (!selectedConversation) return;
        setLoading(true);
        try {
            const body: SendMessageBody = {
                message: messageText,
            };

            if (replyingToMessage) {
                body.replyTo = replyingToMessage._id;
            }

            if (media && media.url && media.type) {
                body.mediaUrl = media.url;
                body.mediaType = media.type;
            }

            const res = await fetch(
                `/api/messages/send/${selectedConversation._id}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(body),
                },
            );

            const data = (await res.json()) as SendMessageResponse;
            if (data.error) {
                throw new Error(data.error);
            }

            setMessages([...messages, data.newMessage]);
            setReplyingToMessage(null);

            updateConversation({
                _id: selectedConversation._id,
                updatedAt:
                    data.newMessage.createdAt || new Date().toISOString(),
            });

            if (data.newConversation) {
                const otherParticipant = data.newConversation.participants.find(
                    (p) => p._id !== authUser?._id,
                );
                if (!otherParticipant) return;

                const formattedNewConversation: Conversation = {
                    _id: data.newConversation._id,
                    isGroupChat: false,
                    fullName: otherParticipant.fullName,
                    profilePic: otherParticipant.profilePic,
                    participantId: otherParticipant._id,
                    username: otherParticipant.username,
                    isPublic: otherParticipant.isPublic,
                };

                setConversations([formattedNewConversation, ...conversations]);
                setSelectedConversation(formattedNewConversation);
            }
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
