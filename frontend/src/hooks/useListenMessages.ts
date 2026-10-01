import { useEffect } from "react";
import { useSocketContext } from "../context/SocketContext";
import useConversation from "../zustand/useConversation";
import notificationSound from "../assets/sounds/notification.mp3";
import useMarkMessagesAsRead from "./useMarkMessagesAsRead";
import type { Message, TypingEvent } from "../types";

const useListenMessages = () => {
    const { markAsRead } = useMarkMessagesAsRead();
    const { socket } = useSocketContext();
    const {
        addMessage,
        updateMessage,
        selectedConversation,
        markMessagesRead,
        setUnreadMessage,
        updateConversation,
        addTypingUser,
        removeTypingUser,
        setTypingUsers,
    } = useConversation();

    useEffect(() => {
        setTypingUsers([]);

        const handleNewMessage = (newMessage: Message) => {
            updateConversation({
                _id: newMessage.receiverId,
                updatedAt: newMessage.createdAt || new Date().toISOString(),
            });

            // Only add message if it's for the currently selected conversation
            if (
                selectedConversation &&
                (newMessage.senderId === selectedConversation._id ||
                    newMessage.receiverId === selectedConversation._id)
            ) {
                newMessage.shouldShake = true;
                const sound = new Audio(notificationSound);
                sound.play();

                addMessage(newMessage);
                markAsRead(selectedConversation._id);
            } else {
                setUnreadMessage(newMessage.receiverId);
                const sound = new Audio(notificationSound);
                sound.play();
            }
        };

        const handleMessageReaction = (updatedMessage: Message) => {
            // Only update message if it's for the currently selected conversation
            if (
                selectedConversation &&
                (updatedMessage.senderId === selectedConversation._id ||
                    updatedMessage.receiverId === selectedConversation._id)
            ) {
                updateMessage(updatedMessage);
            }
        };

        const handleMessagesRead = ({ conversationId, userId }: TypingEvent) => {
            if (
                selectedConversation &&
                selectedConversation._id === conversationId
            ) {
                markMessagesRead(userId);
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

        if (socket) {
            socket.on("newMessage", handleNewMessage);
            socket.on("messageReaction", handleMessageReaction);
            socket.on("messageEdited", handleMessageReaction);
            socket.on("messageDeleted", handleMessageReaction);
            socket.on("messagesRead", handleMessagesRead);
            socket.on("typing", handleTyping);
            socket.on("stopTyping", handleStopTyping);
        }

        return () => {
            if (socket) {
                socket.off("newMessage", handleNewMessage);
                socket.off("messageReaction", handleMessageReaction);
                socket.off("messageEdited", handleMessageReaction);
                socket.off("messageDeleted", handleMessageReaction);
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
        setUnreadMessage,
        selectedConversation,
        updateConversation,
        addTypingUser,
        removeTypingUser,
        setTypingUsers,
    ]);
};

export default useListenMessages;
