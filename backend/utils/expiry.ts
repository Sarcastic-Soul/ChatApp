import type { QueryFilter } from "mongoose";
import type { MessageFields } from "../models/message.model.ts";

// When a message sent now should disappear, if the chat has a timer on
export const expiryFor = (conversation: { disappearAfter?: number | null }) =>
    conversation.disappearAfter ? new Date(Date.now() + conversation.disappearAfter * 1000) : undefined;

// MongoDB clears expired messages about once a minute. Queries leave them
// out from the moment they expire, so nobody sees one in between.
export const notExpired = (): QueryFilter<MessageFields> => ({
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
});

export const hasExpired = (message: { expiresAt?: Date | null }) =>
    !!message.expiresAt && message.expiresAt.getTime() <= Date.now();
