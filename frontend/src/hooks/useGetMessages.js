import { useEffect, useState, useCallback } from "react";
import useConversation from "../zustand/useConversation";
import { notifications } from "@mantine/notifications";
import useMarkMessagesAsRead from "./useMarkMessagesAsRead";
import {
    getCachedMessages,
    setCachedMessages,
    addOlderMessages,
} from "../utils/messageCacheDB";

const useGetMessages = () => {
    const { messages, setMessages, selectedConversation } = useConversation();
    const { markAsRead } = useMarkMessagesAsRead();
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);

    const conversationId = selectedConversation?._id;

    // A more robust check: a real conversation will have messages or be a group chat,
    // a temporary one is just a placeholder with the participant's ID.
    const isRealConversation =
        selectedConversation &&
        (selectedConversation.isGroupChat ||
            conversationId !== selectedConversation.participantId);

    const getMessages = useCallback(async () => {
        if (!conversationId || !isRealConversation) {
            setMessages([]);
            setLoading(false);
            setInitialLoad(false);
            return;
        }

        setLoading(true);
        setInitialLoad(true);

        try {
            const cached = await getCachedMessages(conversationId);
            if (cached && cached.length > 0) {
                setMessages(cached);
                setHasMore(cached.length % 50 === 0);
            }

            // Stale-While-Revalidate: always fetch the latest messages from the network
            const res = await fetch(
                `/api/messages/${conversationId}?limit=50`,
                { credentials: "include" },
            );
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const chronologicalMessages = data.reverse();

            setMessages(chronologicalMessages);
            await setCachedMessages(conversationId, chronologicalMessages);
            setHasMore(data.length === 50);

            // Mark messages as read
            markAsRead(conversationId);
        } catch (error) {
            console.error("Error fetching messages:", error);
            notifications.show({
                message: error.message || "Failed to load messages",
                color: "red",
            });
            setMessages([]);
        } finally {
            setLoading(false);
            setInitialLoad(false);
        }
    }, [conversationId, setMessages, isRealConversation]);

    useEffect(() => {
        // This effect now correctly handles new chats by not calling getMessages for them.
        if (selectedConversation?._id) {
            getMessages();
        } else {
            setMessages([]);
        }
    }, [selectedConversation?._id, getMessages]);

    const loadOlderMessages = useCallback(async () => {
        if (loading || !isRealConversation || messages.length === 0) return;

        setLoading(true);
        try {
            const oldestMessageId = messages[0]?._id;
            const res = await fetch(
                `/api/messages/${conversationId}?before=${oldestMessageId}&limit=50`,
                { credentials: "include" },
            );

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (data.length > 0) {
                const chronologicalOlderMessages = data.reverse();
                const existingIds = new Set(messages.map((msg) => msg._id));
                const newUniqueOlderMessages =
                    chronologicalOlderMessages.filter(
                        (oldMsg) => !existingIds.has(oldMsg._id),
                    );

                if (newUniqueOlderMessages.length > 0) {
                    setMessages((prev) => [...newUniqueOlderMessages, ...prev]);
                    await addOlderMessages(
                        conversationId,
                        newUniqueOlderMessages,
                    );
                }

                setHasMore(data.length === 50);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error("Error loading older messages:", error);
            notifications.show({
                message: error.message || "Failed to load older messages",
                color: "red",
            });
        } finally {
            setLoading(false);
        }
    }, [conversationId, messages, loading, setMessages, isRealConversation]);

    return {
        messages,
        loading: loading && initialLoad,
        hasMore,
        loadOlderMessages,
        isLoadingMore: loading && !initialLoad,
    };
};

export default useGetMessages;
