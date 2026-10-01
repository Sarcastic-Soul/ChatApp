import { create } from "zustand";
import {
    addMessageToCache,
    updateMessageInCache,
} from "../utils/messageCacheDB";
import { senderIdOf } from "../utils/sender";
import type { Conversation, Message } from "../types";

// Puts a message in its place in the list. A copy with the same id or
// client id is replaced (the optimistic copy by the saved one); a new
// message goes in by sequence number. Unsent messages stay at the end.
export const placeMessage = (messages: Message[], message: Message): Message[] => {
    const index = messages.findIndex(
        (msg) => msg._id === message._id || (!!message.clientId && msg.clientId === message.clientId),
    );
    if (index !== -1) {
        const next = [...messages];
        next[index] = { ...message, shouldShake: messages[index].shouldShake };
        return next;
    }

    let position = messages.length;
    if (!message.pending) {
        while (position > 0) {
            const before = messages[position - 1];
            const isLater =
                before.pending ||
                (message.seq != null && before.seq != null && before.seq > message.seq);
            if (!isLater) break;
            position -= 1;
        }
    }
    return [...messages.slice(0, position), message, ...messages.slice(position)];
};

interface ConversationState {
    selectedConversation: Conversation | null;
    setSelectedConversation: (conversation: Conversation | null) => void;

    messages: Message[];
    setMessages: (msgs: Message[] | ((prev: Message[]) => Message[])) => void;

    replyingToMessage: Message | null;
    setReplyingToMessage: (message: Message | null) => void;

    forwardingMessage: Message | null;
    setForwardingMessage: (message: Message | null) => void;

    typingUsers: string[];
    setTypingUsers: (users: string[]) => void;
    addTypingUser: (userId: string) => void;
    removeTypingUser: (userId: string) => void;

    conversations: Conversation[];
    setConversations: (conversations: Conversation[]) => void;
    addConversation: (conversation: Conversation) => void;
    updateConversation: (updatedConv: Partial<Conversation> & Pick<Conversation, "_id">) => void;

    searchTerm: string;
    setSearchTerm: (term: string) => void;

    jumpToMessageId: string | null;
    setJumpToMessageId: (id: string | null) => void;

    unreadMessages: Record<string, boolean>;
    setUnreadMessage: (conversationId: string) => void;
    clearUnreadMessage: (conversationId: string) => void;

    addMessage: (message: Message) => void;
    updateMessage: (updatedMessage: Message) => void;
    removeMessage: (messageId: string) => void;
    // Removes an unsent message the server turned down
    dropMessage: (clientId: string) => void;
    markMessagesRead: (userId: string, upToSeq?: number) => void;
}

const useConversation = create<ConversationState>()((set, get) => ({
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
        set((state) => ({ messages: placeMessage(state.messages, message) }));
        // Unsent messages live in the outbox, not the cache
        if (selectedConversation?._id && !message.pending) {
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

    dropMessage: (clientId) => {
        set((state) => ({
            messages: state.messages.filter((msg) => msg.clientId !== clientId || !msg.pending),
        }));
    },

    // The reader saw everything up to upToSeq. Without a number (older
    // chats), everything they didn't send counts as read.
    markMessagesRead: (userId, upToSeq) => {
        set((state) => ({
            messages: state.messages.map((msg): Message => {
                const msgSenderId = senderIdOf(msg.senderId);
                const seen =
                    upToSeq == null || msg.seq == null || msg.seq <= upToSeq;
                if (msgSenderId !== userId && msg.status !== "read" && !msg.pending && seen) {
                    return { ...msg, status: "read" };
                }
                return msg;
            }),
        }));
    },
}));

export default useConversation;
