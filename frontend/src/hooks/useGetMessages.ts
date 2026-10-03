import { useEffect, useState, useCallback } from "react";
import useConversation from "../zustand/useConversation";
import { notifications } from "@mantine/notifications";
import useMarkMessagesAsRead from "./useMarkMessagesAsRead";
import {
    getCachedMessages,
    setCachedMessages,
    addOlderMessages,
    getOutbox,
} from "../utils/messageCacheDB";
import { errorMessage } from "../utils/errorMessage";
import { openMessages } from "../utils/e2ee/chats";
import type { ApiError, Message } from "../types";

// Messages for this chat still waiting in the outbox, shown after the rest
const unsentFor = async (conversationId: string) => {
    try {
        const outbox = await getOutbox();
        return outbox.filter((entry) => entry.targetId === conversationId).map((entry) => entry.message);
    } catch {
        return [];
    }
};

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
            setMessages(conversationId ? await unsentFor(conversationId) : []);
            setLoading(false);
            setInitialLoad(false);
            return;
        }

        setLoading(true);
        setInitialLoad(true);

        let hasCached = false;
        try {
            const unsent = await unsentFor(conversationId);
            const cached = await getCachedMessages(conversationId);
            hasCached = cached.length > 0;
            if (hasCached) {
                setMessages([...cached, ...unsent]);
                setHasMore(cached.length % 50 === 0);
            }

            // Stale-While-Revalidate: always fetch the latest messages from the network
            const res = await fetch(
                `/api/messages/${conversationId}?limit=50`,
                { credentials: "include" },
            );
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = (await res.json()) as Message[] & ApiError;
            if (data.error) throw new Error(data.error);

            // Decrypted before they're shown or cached
            const chronologicalMessages = await openMessages(data.reverse());

            setMessages([...chronologicalMessages, ...(await unsentFor(conversationId))]);
            await setCachedMessages(conversationId, chronologicalMessages);
            setHasMore(data.length === 50);

            // Mark messages as read
            markAsRead(conversationId);
        } catch (error) {
            console.error("Error fetching messages:", error);
            // Offline: the saved copy stays on screen
            if (!hasCached || navigator.onLine) {
                notifications.show({
                    message: errorMessage(error) || "Failed to load messages",
                    color: "red",
                });
            }
            if (!hasCached) setMessages([]);
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

            const data = (await res.json()) as Message[] & ApiError;
            if (data.error) throw new Error(data.error);

            if (conversationId && data.length > 0) {
                const chronologicalOlderMessages = await openMessages(data.reverse());
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
                message: errorMessage(error) || "Failed to load older messages",
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
