import { useEffect } from "react";
import { useSocketContext } from "../context/SocketContext";
import useConversation from "../zustand/useConversation";
import notificationSound from "../assets/sounds/notification.mp3";
import useMarkMessagesAsRead from "./useMarkMessagesAsRead";
import { reloadConversations } from "./useGetConversations";
import { openMessage } from "../utils/e2ee/chats";
import { senderIdOf } from "../utils/sender";
import { useAuthContext } from "../context/AuthContext";
import type { Message, ReadReceipt, TypingEvent } from "../types";

const useListenMessages = () => {
    const { markAsRead } = useMarkMessagesAsRead();
    const { socket } = useSocketContext();
    const { authUser } = useAuthContext();
    const {
        addMessage,
        updateMessage,
        selectedConversation,
        markMessagesRead,
        noteMessage,
        refreshPreview,
        updateConversation,
        addTypingUser,
        removeTypingUser,
        setTypingUsers,
    } = useConversation();

    useEffect(() => {
        setTypingUsers([]);

        const handleNewMessage = (newMessage: Message) => {
            const isOpen =
                !!selectedConversation &&
                (newMessage.senderId === selectedConversation._id ||
                    newMessage.receiverId === selectedConversation._id);
            // Group notices show as the preview but don't count as unread
            noteMessage(newMessage, !isOpen && !newMessage.isSystem);
            // The first message of a chat this browser hasn't listed yet
            const known = useConversation.getState().conversations.some((c) => c._id === newMessage.receiverId);
            if (!known) {
                reloadConversations().catch((error) => console.error("Error loading chats:", error));
            }

            // A notice about the user's own change comes back here too
            const fromMe = senderIdOf(newMessage.senderId) === authUser?._id;
            if (!fromMe) void new Audio(notificationSound).play().catch(() => undefined);

            if (isOpen) {
                newMessage.shouldShake = !fromMe;
                addMessage(newMessage);
                markAsRead(selectedConversation._id);
            }
        };

        const handleMessageReaction = (updatedMessage: Message) => {
            refreshPreview(updatedMessage);
            // Only update message if it's for the currently selected conversation
            if (
                selectedConversation &&
                (updatedMessage.senderId === selectedConversation._id ||
                    updatedMessage.receiverId === selectedConversation._id)
            ) {
                updateMessage(updatedMessage);
            }
        };

        const handleMessagesRead = ({ conversationId, userId, upToSeq }: ReadReceipt) => {
            if (
                selectedConversation &&
                selectedConversation._id === conversationId
            ) {
                markMessagesRead(userId, upToSeq);
            }
        };

        // Someone changed the chat's disappearing messages timer
        const handleChatTimer = ({ conversationId, disappearAfter }: { conversationId: string; disappearAfter: number }) => {
            updateConversation({ _id: conversationId, disappearAfter });
            const { selectedConversation: open, setSelectedConversation } = useConversation.getState();
            if (open?._id === conversationId) setSelectedConversation({ ...open, disappearAfter });
        };

        const handleTyping = ({ conversationId, userId }: TypingEvent) => {
            if (
                selectedConversation &&
                selectedConversation._id === conversationId
            ) {
                addTypingUser(userId);
            }
        };

        const handleStopTyping = ({ conversationId, userId }: TypingEvent) => {
            if (
                selectedConversation &&
                selectedConversation._id === conversationId
            ) {
                removeTypingUser(userId);
            }
        };

        // End-to-end text arrives as ciphertext and is decrypted first
        const decrypted = (handler: (message: Message) => void) => (message: Message) => {
            openMessage(message)
                .then(handler)
                .catch((error) => console.error("Error decrypting message:", error));
        };
        const onNewMessage = decrypted(handleNewMessage);
        const onMessageChange = decrypted(handleMessageReaction);

        if (socket) {
            socket.on("newMessage", onNewMessage);
            socket.on("messageReaction", onMessageChange);
            socket.on("messageEdited", onMessageChange);
            socket.on("messageDeleted", onMessageChange);
            socket.on("messagesRead", handleMessagesRead);
            socket.on("chatTimer", handleChatTimer);
            socket.on("typing", handleTyping);
            socket.on("stopTyping", handleStopTyping);
        }

        return () => {
            if (socket) {
                socket.off("newMessage", onNewMessage);
                socket.off("messageReaction", onMessageChange);
                socket.off("messageEdited", onMessageChange);
                socket.off("messageDeleted", onMessageChange);
                socket.off("messagesRead", handleMessagesRead);
                socket.off("chatTimer", handleChatTimer);
                socket.off("typing", handleTyping);
                socket.off("stopTyping", handleStopTyping);
            }
        };
    }, [
        socket,
        authUser?._id,
        addMessage,
        updateMessage,
        markMessagesRead,
        noteMessage,
        refreshPreview,
        updateConversation,
        selectedConversation,
        addTypingUser,
        removeTypingUser,
        setTypingUsers,
    ]);
};

export default useListenMessages;
