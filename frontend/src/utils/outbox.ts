import { notifications } from "@mantine/notifications";
import useConversation from "../zustand/useConversation";
import { getOutbox, removeFromOutbox, type OutboxEntry } from "./messageCacheDB";
import { openMessage, sendSealed } from "./e2ee/chats";
import type { ApiError, Conversation, Message, PublicUser } from "../types";

// Every message is saved to the outbox in IndexedDB before it is sent and
// removed once the server has it. Sends that fail because the network or
// the server is down stay there and go out again later, in order. The
// server ignores a repeat of a client id it already saved, so a retry
// never makes a duplicate. The text is encrypted just before each try, so
// a retry always uses the chat's newest key.

interface SendResponse extends ApiError {
    newMessage?: Message;
    // Sent back when the message was addressed to a user id
    newConversation?: { _id: string; participants: PublicUser[] };
}

type Outcome = "sent" | "rejected" | "retry";

// Waits between retries while the server stays unreachable
const RETRY_DELAYS = [2000, 5000, 15000, 30000, 60000];

let flushing: Promise<void> | null = null;
let flushAgain = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let failures = 0;

const toConversation = (
    data: NonNullable<SendResponse["newConversation"]>,
    authUserId: string,
): Conversation | null => {
    const other = data.participants.find((p) => p._id !== authUserId);
    if (!other) return null;
    return {
        _id: data._id,
        isGroupChat: false,
        fullName: other.fullName,
        profilePic: other.profilePic,
        participantId: other._id,
        username: other.username,
        isPublic: other.isPublic,
    };
};

// Swaps the optimistic copy for the saved message, and moves a new chat
// from its stand-in (keyed by the other user's id) to the real one
const applySent = async (
    entry: OutboxEntry,
    data: SendResponse & { newMessage: Message },
    authUserId: string,
) => {
    const { newConversation } = data;
    const newMessage = await openMessage(data.newMessage);
    const state = useConversation.getState();
    const openId = state.selectedConversation?._id;

    if (newConversation) {
        const known = state.conversations.find((c) => c._id === newConversation._id);
        const conversation = known ?? toConversation(newConversation, authUserId);
        if (conversation) {
            if (!known) state.setConversations([conversation, ...state.conversations]);
            if (openId === entry.targetId && openId !== conversation._id) {
                state.setSelectedConversation(conversation);
            }
        }
    }

    const nowOpen = useConversation.getState().selectedConversation?._id;
    if (nowOpen === entry.targetId || nowOpen === newMessage.receiverId) {
        state.addMessage(newMessage);
    }
    state.noteMessage(newMessage);
};

const deliver = async (entry: OutboxEntry, authUserId: string): Promise<Outcome> => {
    let res: Response;
    try {
        res = await sendSealed(entry.targetId, String(entry.body.message ?? ""), (fields) =>
            fetch(`/api/messages/send/${entry.targetId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...entry.body, ...fields }),
            }),
        );
    } catch {
        return "retry"; // offline, or the chat's keys couldn't be loaded
    }

    // Server down, still waking up, rate limited, or the chat's keys
    // changed again: try again later
    if (res.status >= 500 || res.status === 429 || res.status === 409) return "retry";

    const data = (await res.json().catch(() => ({}))) as SendResponse;
    await removeFromOutbox(entry.clientId);

    if (!res.ok || !data.newMessage) {
        useConversation.getState().dropMessage(entry.clientId);
        notifications.show({ message: data.error || "Message not sent", color: "red" });
        return "rejected";
    }

    await applySent(entry, { ...data, newMessage: data.newMessage }, authUserId);
    return "sent";
};

const scheduleRetry = (authUserId: string) => {
    clearTimeout(retryTimer);
    const delay = RETRY_DELAYS[Math.min(failures, RETRY_DELAYS.length - 1)];
    failures += 1;
    retryTimer = setTimeout(() => void flushOutbox(authUserId), delay);
};

// Sends everything in the outbox, oldest first. Stops at the first message
// that can't go out yet, so later ones never overtake it.
export const flushOutbox = (authUserId: string): Promise<void> => {
    if (flushing) {
        flushAgain = true;
        return flushing;
    }
    flushing = (async () => {
        do {
            flushAgain = false;
            for (const entry of await getOutbox()) {
                if ((await deliver(entry, authUserId)) === "retry") {
                    scheduleRetry(authUserId);
                    return;
                }
            }
            failures = 0;
        } while (flushAgain);
    })()
        .catch((error) => console.error("Error sending queued messages:", error))
        .finally(() => {
            flushing = null;
        });
    return flushing;
};

export const stopOutboxRetries = () => {
    clearTimeout(retryTimer);
    failures = 0;
};
