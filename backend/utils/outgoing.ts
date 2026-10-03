import type { Response } from "express";
import type { MessageDocument, QuotedMessage } from "../models/message.model.ts";
import type { PublicUser } from "../models/user.model.ts";
import { decryptText } from "./encryption.ts";
import type { KeyRefusal } from "./chatKeys.ts";

// How a saved message is made ready to send to browsers. Shared by the
// controllers that send, change and list messages.

// Messages go out with the sender's profile and the message they reply to
export const WITH_SENDER_AND_REPLY = [
    { path: "senderId", select: "fullName profilePic username isPublic" },
    { path: "replyTo", select: "message mediaType mediaUrl senderId e2ee" },
];
export type WithSenderAndReply = { senderId: PublicUser; replyTo: QuotedMessage | null };

// The text as the browser should get it. End-to-end encrypted text goes
// out as the ciphertext it came in as; only the browsers can read it.
export const outgoingText = (message: { message?: string | null; e2ee?: unknown }) => {
    if (!message.message) return "";
    return message.e2ee ? message.message : decryptText(message.message);
};

// Decrypts a saved message and the message it quotes, ready to send out
export const readableMessage = async (message: MessageDocument) => {
    const populated = await message.populate<WithSenderAndReply>(WITH_SENDER_AND_REPLY);
    populated.message = outgoingText(populated);
    if (populated.replyTo) {
        populated.replyTo.message = outgoingText(populated.replyTo);
    }
    return populated;
};

export const refuseKeys = (res: Response, refusal: KeyRefusal) =>
    res.status(refusal.status).json({ error: refusal.error, code: refusal.code });

export type ReadableMessage = Awaited<ReturnType<typeof readableMessage>>;
