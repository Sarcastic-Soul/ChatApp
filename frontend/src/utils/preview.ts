import { senderIdOf } from "./sender";
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
    if (!message || message.e2ee) return "";
    if (message.isSystem || message.isDeleted) return message.message;

    const body = message.undecryptable
        ? "Encrypted message"
        : message.message || MEDIA_LABELS[message.mediaType] || "";
    if (message.isCall) return body;

    const senderId = senderIdOf(message.senderId);
    if (senderId === ownId) return `You: ${body}`;
    if (!conversation.isGroupChat) return body;
    const sender = conversation.participants?.find((p) => p._id === senderId);
    return sender ? `${sender.fullName.split(" ")[0]}: ${body}` : body;
};

// Counts past 99 would stretch the badge
export const unreadLabel = (count: number) => (count > 99 ? "99+" : String(count));
