import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import useConversation from "../zustand/useConversation";
import { isPushSupported, resyncSubscription } from "../utils/push";

// Opens the chat a push notification was for. A click with no tab open
// loads /?chat=<id>; a click with a tab open arrives as a message from the
// service worker. The chat list may still be loading, so the id waits in
// pendingId until it arrives.
const useNotificationChat = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const pendingId = useRef(searchParams.get("chat"));
    const conversations = useConversation((state) => state.conversations);

    const openPending = () => {
        const { conversations, setSelectedConversation, clearUnreadMessage } = useConversation.getState();
        if (!pendingId.current || conversations.length === 0) return;
        const conversation = conversations.find((c) => c._id === pendingId.current);
        pendingId.current = null;
        if (!conversation) return;
        setSelectedConversation(conversation);
        clearUnreadMessage(conversation._id);
        if (conversation.participantId) clearUnreadMessage(conversation.participantId);
    };

    useEffect(() => {
        resyncSubscription();
        if (!isPushSupported()) return;
        const onMessage = (event: MessageEvent<{ type?: string; conversationId?: string } | null>) => {
            if (event.data?.type !== "open-chat") return;
            pendingId.current = event.data.conversationId ?? null;
            openPending();
        };
        navigator.serviceWorker.addEventListener("message", onMessage);
        return () => navigator.serviceWorker.removeEventListener("message", onMessage);
    }, []);

    useEffect(() => {
        openPending();
        if (conversations.length > 0 && searchParams.has("chat")) {
            searchParams.delete("chat");
            setSearchParams(searchParams, { replace: true });
        }
    }, [conversations, searchParams, setSearchParams]);
};

export default useNotificationChat;
