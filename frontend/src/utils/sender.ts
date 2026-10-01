import type { Message, PublicUser } from "../types";

// senderId is a plain id on messages loaded from history and the sender's
// profile on messages that arrived live
export const senderIdOf = (sender: Message["senderId"]): string =>
    typeof sender === "string" ? sender : sender._id;

export const senderProfileOf = (sender: Message["senderId"]): PublicUser | null =>
    typeof sender === "string" ? null : sender;
