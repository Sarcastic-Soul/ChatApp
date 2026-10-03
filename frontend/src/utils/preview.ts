import { hasExpired } from "./expiry";
import { senderIdOf, senderProfileOf } from "./sender";
import type { Conversation, MediaType, Message } from "../types";

const MEDIA_LABELS: Record<MediaType, string> = {
    text: "",
    image: "Photo",
    video: "Video",
    audio: "Voice message",
    file: "File",
};

// The line under a chat's name in the list: its newest message, with who
// sent it. Empty while an end-to-end message is still being decrypted.
export const previewText = (conversation: Conversation, ownId?: string): string => {
    const message = conversation.lastMessage;
    if (!message || message.e2ee || hasExpired(message)) return "";
    if (message.isDeleted) return message.message;

    const senderId = senderIdOf(message.senderId);
    const sender =
        senderProfileOf(message.senderId) ?? conversation.participants?.find((p) => p._id === senderId);
    const firstName = sender?.fullName.split(" ")[0];

    // Group notices read as a sentence: "Bob added Carol"
    if (message.isSystem) {
        const who = senderId === ownId ? "You" : (firstName ?? (!conversation.isGroupChat && conversation.fullName?.split(" ")[0]));
        return who ? `${who} ${message.message}` : message.message;
    }

    const body = message.undecryptable
        ? "Encrypted message"
        : message.message || MEDIA_LABELS[message.mediaType] || "";
    if (message.isCall) return body;

    if (senderId === ownId) return `You: ${body}`;
    if (!conversation.isGroupChat) return body;
    return firstName ? `${firstName}: ${body}` : body;
};

// Counts past 99 would stretch the badge
export const unreadLabel = (count: number) => (count > 99 ? "99+" : String(count));
