import { useEffect } from "react";
import { useAuthContext } from "../context/AuthContext";
import { useSocketContext } from "../context/SocketContext";
import useConversation from "../zustand/useConversation";
import { flushOutbox, stopOutboxRetries } from "../utils/outbox";
import { openMessages } from "../utils/e2ee/chats";
import type { ApiError, Message } from "../types";

const CATCH_UP_PAGE = 100;
const MAX_CATCH_UP_PAGES = 5;

// Fetches the messages the open chat missed while the socket was down,
// using the newest sequence number already on screen
const catchUp = async () => {
    const { selectedConversation, messages } = useConversation.getState();
    if (!selectedConversation) return;
    const chatId = selectedConversation._id;
    // A new chat has no messages on the server yet
    if (!selectedConversation.isGroupChat && chatId === selectedConversation.participantId) return;

    let lastSeq = Math.max(-1, ...messages.map((msg) => msg.seq ?? -1));
    if (lastSeq < 0) return;

    for (let page = 0; page < MAX_CATCH_UP_PAGES; page += 1) {
        const res = await fetch(`/api/messages/${chatId}?after=${lastSeq}&limit=${CATCH_UP_PAGE}`);
        if (!res.ok) return;
        const missed = await openMessages((await res.json()) as Message[] & ApiError);

        const state = useConversation.getState();
        if (state.selectedConversation?._id !== chatId) return;
        missed.forEach((msg) => state.addMessage(msg));
        if (missed.length) {
            void fetch(`/api/messages/read/${chatId}`, { method: "POST" });
        }

        if (missed.length < CATCH_UP_PAGE) return;
        lastSeq = missed[missed.length - 1].seq ?? lastSeq;
    }
};

// Sends queued messages whenever a connection comes back, and fills in
// what the open chat missed after a reconnect
const useDelivery = () => {
    const { socket } = useSocketContext();
    const { authUser } = useAuthContext();
    const userId = authUser?._id;

    useEffect(() => {
        if (!socket || !userId) return;

        const flush = () => void flushOutbox(userId);
        const refill = () =>
            catchUp().catch((error) => console.error("Error catching up on messages:", error));

        flush();
        socket.on("connect", flush);
        socket.io.on("reconnect", refill);
        window.addEventListener("online", flush);

        return () => {
            socket.off("connect", flush);
            socket.io.off("reconnect", refill);
            window.removeEventListener("online", flush);
            stopOutboxRetries();
        };
    }, [socket, userId]);
};

export default useDelivery;
