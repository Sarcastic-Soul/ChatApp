import { useEffect, useRef } from "react";
import type { AuthUser } from "../types";

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];
// The backend hands out TURN credentials that stay valid for at least 12 hours
const ICE_SERVERS_MAX_AGE = 6 * 60 * 60 * 1000;

// Gives back a function that builds the settings for a new peer connection.
const useIceServers = (authUser: AuthUser | null) => {
    // ICE servers come from the backend, which adds TURN relay credentials
    // when a provider is set up. They are fetched ahead of time so starting
    // or answering a call doesn't wait on a request.
    const iceServersRef = useRef<{ servers: RTCIceServer[]; fetchedAt: number }>({
        servers: FALLBACK_ICE_SERVERS,
        fetchedAt: 0,
    });

    const refreshIceServers = async () => {
        try {
            const res = await fetch("/api/calls/ice-servers", { credentials: "include" });
            if (!res.ok) return;
            const { iceServers } = (await res.json()) as { iceServers?: RTCIceServer[] };
            if (Array.isArray(iceServers) && iceServers.length) {
                iceServersRef.current = { servers: iceServers, fetchedAt: Date.now() };
            }
        } catch {
            // Keep the STUN servers
        }
    };

    useEffect(() => {
        if (authUser) refreshIceServers();
    }, [authUser]);

    const getConfiguration = async () => {
        if (Date.now() - iceServersRef.current.fetchedAt > ICE_SERVERS_MAX_AGE) {
            await refreshIceServers();
        }
        return { iceServers: iceServersRef.current.servers };
    };

    return getConfiguration;
};

export default useIceServers;
