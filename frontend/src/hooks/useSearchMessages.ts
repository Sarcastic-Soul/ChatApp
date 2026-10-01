import { useEffect, useState } from "react";
import { errorMessage } from "../utils/errorMessage";
import type { ApiError, SearchResult } from "../types";

const MIN_LENGTH = 2;
const DELAY = 250;

// Searches message text across every chat on the server, a short moment
// after the person stops typing. Older requests are cancelled.
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
                const res = await fetch(`/api/messages/search?q=${encodeURIComponent(trimmed)}`, {
                    credentials: "include",
                    signal: controller.signal,
                });
                const data = (await res.json()) as SearchResult[] & ApiError;
                if (!res.ok) throw new Error(data.error || "Search failed");
                setResults(data);
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
