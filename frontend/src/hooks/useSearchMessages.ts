import { useEffect, useState } from "react";
import { errorMessage } from "../utils/errorMessage";
import { searchCachedMessages } from "../utils/messageCacheDB";
import { senderIdOf, senderProfileOf } from "../utils/sender";
import type { ApiError, SearchResult } from "../types";

const MIN_LENGTH = 2;
const DELAY = 250;

// Searches message text across every chat, a short moment after the person
// stops typing. Older requests are cancelled. The server can only search
// text it can read, so end-to-end encrypted messages are searched in this
// browser's cache and the two lists are merged.

const LIMIT = 20;

const localMatches = async (query: string): Promise<SearchResult[]> => {
    try {
        const found = await searchCachedMessages(query, LIMIT);
        return found.map((m) => ({
            _id: m._id,
            conversationId: m.receiverId,
            message: m.message,
            createdAt: m.createdAt,
            sender: senderProfileOf(m.senderId),
            senderId: senderIdOf(m.senderId),
        }));
    } catch {
        return [];
    }
};

const useSearchMessages = (query: string) => {
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const trimmed = query.trim();
    const active = trimmed.length >= MIN_LENGTH;

    useEffect(() => {
        if (!active) return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const local = localMatches(trimmed);
                const res = await fetch(`/api/messages/search?q=${encodeURIComponent(trimmed)}`, {
                    credentials: "include",
                    signal: controller.signal,
                });
                const data = (await res.json()) as SearchResult[] & ApiError;
                if (!res.ok) throw new Error(data.error || "Search failed");
                const seen = new Set(data.map((hit) => hit._id));
                const merged = [...data, ...(await local).filter((hit) => !seen.has(hit._id))]
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .slice(0, LIMIT);
                if (!controller.signal.aborted) setResults(merged);
            } catch (err) {
                if (!(err instanceof Error && err.name === "AbortError")) setError(errorMessage(err));
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, DELAY);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [trimmed, active]);

    return { active, results: active ? results : [], loading: active && loading, error: active ? error : null };
};

export default useSearchMessages;
