import { useEffect } from "react";
import { useSocketContext } from "../context/SocketContext";
import useConversation from "../zustand/useConversation";
import notificationSound from "../assets/sounds/notification.mp3";
import useMarkMessagesAsRead from "./useMarkMessagesAsRead";
import { openMessage } from "../utils/e2ee/chats";
import type { Message, ReadReceipt, TypingEvent } from "../types";

const useListenMessages = () => {
    const { markAsRead } = useMarkMessagesAsRead();
    const { socket } = useSocketContext();
    const {
        addMessage,
        updateMessage,
        selectedConversation,
        markMessagesRead,
        noteMessage,
        refreshPreview,
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

            // Only add message if it's for the currently selected conversation
            if (isOpen) {
                newMessage.shouldShake = true;
                const sound = new Audio(notificationSound);
                sound.play();

                addMessage(newMessage);
                markAsRead(selectedConversation._id);
            } else {
                const sound = new Audio(notificationSound);
                sound.play();
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
                socket.off("typing", handleTyping);
                socket.off("stopTyping", handleStopTyping);
            }
        };
    }, [
        socket,
        addMessage,
        updateMessage,
        markMessagesRead,
        noteMessage,
        refreshPreview,
        selectedConversation,
        addTypingUser,
        removeTypingUser,
        setTypingUsers,
    ]);
};

export default useListenMessages;
