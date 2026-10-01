import { useEffect, useState } from "react";

const MIN_LENGTH = 2;
const DELAY = 250;

// Searches message text across every chat on the server, a short moment
// after the person stops typing. Older requests are cancelled.
const useSearchMessages = (query) => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
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
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Search failed");
                setResults(data);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
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
