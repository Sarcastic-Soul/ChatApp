import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "../context/AuthContext";
import { chatKeyHolders, isEndToEnd } from "../utils/e2ee/chats";
import { checkPeers, type KeyHolder, type PeerTrust } from "../utils/e2ee/trust";

interface ChatTrust {
    chatId: string;
    endToEnd: boolean;
    // This user's own key, as the server lists it for the chat
    me: KeyHolder | null;
    // Everyone else in the chat, with what this browser remembers of their key
    peers: PeerTrust[];
}

// Whether the open chat is end-to-end encrypted, and whether its members'
// keys are the ones this browser has seen before
const useChatTrust = (chatId?: string) => {
    const { authUser } = useAuthContext();
    const myId = authUser?._id;
    const [trust, setTrust] = useState<ChatTrust | null>(null);

    const load = useCallback(async () => {
        if (!chatId || !myId) return null;
        const endToEnd = await isEndToEnd(chatId);
        const holders = endToEnd ? await chatKeyHolders(chatId) : [];
        const peers = await checkPeers(
            myId,
            holders.filter((holder) => holder._id !== myId),
        );
        return { chatId, endToEnd, me: holders.find((holder) => holder._id === myId) ?? null, peers };
    }, [chatId, myId]);

    useEffect(() => {
        let stale = false;
        load()
            .then((next) => !stale && setTrust(next))
            .catch(() => {});
        return () => {
            stale = true;
        };
    }, [load]);

    const reload = useCallback(() => {
        load()
            .then(setTrust)
            .catch(() => {});
    }, [load]);

    // Answers for a chat that is no longer open are ignored
    const current = trust?.chatId === chatId ? trust : null;
    return {
        endToEnd: current?.endToEnd ?? false,
        me: current?.me ?? null,
        peers: current?.peers ?? [],
        reload,
    };
};

export default useChatTrust;
