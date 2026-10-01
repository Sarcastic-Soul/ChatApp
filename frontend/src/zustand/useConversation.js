import { create } from "zustand";
import {
    addMessageToCache,
    updateMessageInCache,
} from "../utils/messageCacheDB";

const useConversation = create((set, get) => ({
    selectedConversation: null,
    setSelectedConversation: (conversation) =>
        set({ selectedConversation: conversation }),

    messages: [],
    setMessages: (msgs) =>
        set((state) => ({
            messages: typeof msgs === "function" ? msgs(state.messages) : msgs,
        })),

    replyingToMessage: null,
    setReplyingToMessage: (message) => set({ replyingToMessage: message }),

    forwardingMessage: null,
    setForwardingMessage: (message) => set({ forwardingMessage: message }),

    typingUsers: [],
    setTypingUsers: (users) => set({ typingUsers: users }),
    addTypingUser: (userId) =>
        set((state) => ({
            typingUsers: state.typingUsers.includes(userId)
                ? state.typingUsers
                : [...state.typingUsers, userId],
        })),
    removeTypingUser: (userId) =>
        set((state) => ({
            typingUsers: state.typingUsers.filter((id) => id !== userId),
        })),

    conversations: [],
    setConversations: (conversations) => set({ conversations }),
    addConversation: (conversation) =>
        set((state) => ({
            conversations: [conversation, ...state.conversations],
        })),
    updateConversation: (updatedConv) =>
        set((state) => ({
            conversations: state.conversations.map((conv) =>
                conv._id === updatedConv._id
                    ? { ...conv, ...updatedConv }
                    : conv,
            ),
        })),

    searchTerm: "",
    setSearchTerm: (term) => set({ searchTerm: term }),

    // A message picked from search results, scrolled to once the chat loads
    jumpToMessageId: null,
    setJumpToMessageId: (id) => set({ jumpToMessageId: id }),

    unreadMessages: {},
    setUnreadMessage: (conversationId) =>
        set((state) => ({
            unreadMessages: { ...state.unreadMessages, [conversationId]: true },
        })),
    clearUnreadMessage: (conversationId) =>
        set((state) => {
            const newUnread = { ...state.unreadMessages };
            delete newUnread[conversationId];
            return { unreadMessages: newUnread };
        }),

    addMessage: (message) => {
        const { selectedConversation } = get();
        set((state) => {
            const messageExists = state.messages.some(
                (msg) => msg._id === message._id,
            );
            if (messageExists) return state;
            return { messages: [...state.messages, message] };
        });
        if (selectedConversation?._id) {
            addMessageToCache(selectedConversation._id, message);
        }
    },

    updateMessage: (updatedMessage) => {
        const { selectedConversation } = get();
        set((state) => ({
            messages: state.messages.map((msg) =>
                msg._id === updatedMessage._id ? updatedMessage : msg,
            ),
        }));
        if (selectedConversation?._id) {
            updateMessageInCache(selectedConversation._id, updatedMessage);
        }
    },

    removeMessage: (messageId) => {
        set((state) => ({
            messages: state.messages.filter((msg) => msg._id !== messageId),
        }));
    },

    markMessagesRead: (userId) => {
        set((state) => ({
            messages: state.messages.map((msg) => {
                const msgSenderId = msg.senderId?._id || msg.senderId;
                if (msgSenderId !== userId && msg.status !== "read") {
                    return { ...msg, status: "read" };
                }
                return msg;
            }),
        }));
    },
}));

export default useConversation;
