import { useState } from "react";
import useConversation from "../zustand/useConversation";
import { notifications } from "@mantine/notifications";
import { useAuthContext } from "../context/AuthContext";

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

    const sendMessage = async (messageText = "", media = null) => {
        setLoading(true);
        try {
            const body = {
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

            const data = await res.json();
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
                    (p) => p._id !== authUser._id,
                );

                const formattedNewConversation = {
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
            console.error("Error sending message:", error.message);
            notifications.show({ message: error.message, color: "red" });
        } finally {
            setLoading(false);
        }
    };

    return { sendMessage, loading };
};

export default useSendMessage;
