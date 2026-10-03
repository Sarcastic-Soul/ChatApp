import type { Response } from "express";
import type { ValidatedRequest } from "../middleware/validate.ts";
import type { conversationIdSchema, getMessagesSchema, sendMessageSchema } from "../validation/schemas.ts";
import { errorMessage } from "../utils/errorMessage.ts";
import Conversation from "../models/conversation.model.ts";
import type { QueryFilter } from "mongoose";
import Message, { type MessageFields, type QuotedMessage } from "../models/message.model.ts";
import User from "../models/user.model.ts";
import { emitToChat, isOnline } from "../socket/socket.ts";
import { encryptText } from "../utils/encryption.ts";
import { cleanProfanity } from "../utils/profanityFilter.ts";
import { messageNotification, sendPushToUsers } from "../utils/push.ts";
import { searchTokensFor } from "../utils/searchIndex.ts";
import { ensureSequenced, nextSeq, recordMessage } from "../utils/sequence.ts";
import { checkChatKey } from "../utils/chatKeys.ts";
import { expiryFor, notExpired } from "../utils/expiry.ts";
import { outgoingText, readableMessage, refuseKeys, type ReadableMessage } from "../utils/outgoing.ts";

// Sending, listing and reading messages. Changing a sent message is in
// messageChange.controller.ts.

const isDuplicateKeyError = (error: unknown) =>
    (error as { code?: number }).code === 11000;

export const sendMessage = async (req: ValidatedRequest<typeof sendMessageSchema>, res: Response) => {
    try {
        // Checked by sendMessageSchema. System messages are only made by the server.
        const { message, mediaUrl, mediaType, replyTo, isCall, isForwarded, clientId, e2ee, newKey } =
            req.body;
        const { id: conversationIdOrUserId } = req.params;
        const senderId = req.user._id;

        // The 1-on-1 lookup below would otherwise match any of the sender's chats
        if (conversationIdOrUserId === senderId.toString()) {
            return res.status(400).json({ error: "You can't message yourself." });
        }

        // Sent to a user id rather than a chat id: the reply includes the
        // chat, so the browser can switch to it (also on a retried send)
        let addressedByUserId = false;
        let conversation = await Conversation.findById(conversationIdOrUserId);

        if (!conversation) {
            addressedByUserId = true;
            conversation = await Conversation.findOne({
                isGroupChat: false,
                participants: { $all: [senderId, conversationIdOrUserId] },
            });

            if (!conversation) {
                const receiver = await User.findById(conversationIdOrUserId);
                if (!receiver) {
                    return res.status(404).json({ error: "User not found" });
                }
                if (receiver.isPublic === false) {
                    return res
                        .status(403)
                        .json({ error: "You cannot message a private user." });
                }

                conversation = await Conversation.create({
                    participants: [senderId, conversationIdOrUserId],
                });
            }
        }

        if (!conversation.participants.includes(senderId)) {
            return res.status(403).json({
                error: "You are not a participant in this conversation.",
            });
        }

        const respond = async (status: number, newMessage: ReadableMessage) => {
            if (!addressedByUserId) return res.status(status).json({ newMessage });
            const newConversation = await conversation.populate(
                "participants",
                "fullName profilePic username isPublic",
            );
            return res.status(status).json({ newMessage, newConversation });
        };

        // A retry of a send that already went through gets the saved copy back
        if (clientId) {
            const existing = await Message.findOne({ senderId, clientId });
            if (existing) return respond(200, await readableMessage(existing));
        }

        // Replies show the quoted text, so it must come from this chat
        if (replyTo && !(await Message.exists({ _id: replyTo, receiverId: conversation._id }))) {
            return res
                .status(400)
                .json({ error: "You can only reply to messages in this chat." });
        }

        const refusal = await checkChatKey({ conversation, senderId, e2ee, newKey, plainAllowed: isCall });
        if (refusal) return refuseKeys(res, refusal);

        // The browser already filtered and encrypted end-to-end text; the
        // server can't read it, so it can't index it for search either
        const cleanedText = !e2ee && message ? cleanProfanity(message) : "";

        const newMessage = new Message({
            senderId,
            receiverId: conversation._id,
            clientId,
            message: e2ee ? message : cleanedText ? encryptText(cleanedText) : "",
            e2ee,
            searchTokens: cleanedText ? searchTokensFor(cleanedText) : undefined,
            mediaUrl: mediaUrl || null,
            mediaType,
            replyTo: replyTo || null,
            isCall,
            isForwarded,
            expiresAt: expiryFor(conversation),
        });

        const seq = await nextSeq(conversation._id);
        newMessage.seq = seq;
        try {
            await newMessage.save();
        } catch (error) {
            // Two copies of the same send arrived at once and the other one
            // won: answer with the winner
            if (!clientId || !isDuplicateKeyError(error)) throw error;
            const winner = await Message.findOne({ senderId, clientId });
            if (!winner) throw error;
            return respond(200, await readableMessage(winner));
        }

        const others = conversation.participants.filter((p) => !p.equals(senderId));
        await recordMessage(conversation._id, { _id: newMessage._id, seq }, others);

        const populatedMessage = await readableMessage(newMessage);

        emitToChat(conversation, "newMessage", populatedMessage, senderId);

        // People with no open tab get a push notification instead
        const online = await Promise.all(others.map((p) => isOnline(p)));
        const offlineIds = others.filter((_p, index) => !online[index]);
        if (offlineIds.length) {
            const payload = messageNotification({
                conversation,
                message: populatedMessage,
                sender: populatedMessage.senderId,
            });
            sendPushToUsers(offlineIds, payload).catch((error) =>
                console.error("Error sending push notifications:", errorMessage(error)),
            );
        }

        return respond(201, populatedMessage);
    } catch (error) {
        console.error("Error in sendMessage controller: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getMessages = async (req: ValidatedRequest<typeof getMessagesSchema>, res: Response) => {
    try {
        const { id: conversationId } = req.params;
        const { before, after, limit } = req.query;
        const senderId = req.user._id;

        const conversation = await Conversation.findById(conversationId);

        if (!conversation || !conversation.participants.includes(senderId)) {
            return res.status(404).json({
                error: "Conversation not found or you are not a member.",
            });
        }

        await ensureSequenced(conversation._id);

        const messageQuery: QueryFilter<MessageFields> = { receiverId: conversation._id, ...notExpired() };

        if (after !== undefined) {
            // Catching up after a reconnect: only what came after `after`
            messageQuery.seq = { $gt: after };
        } else if (before) {
            const beforeMsg = await Message.findById(before);
            if (beforeMsg?.seq != null) {
                messageQuery.seq = { $lt: beforeMsg.seq };
            } else if (beforeMsg) {
                messageQuery.createdAt = { $lt: beforeMsg.createdAt };
            }
        }

        // Newest first, except a catch-up, which comes oldest first
        const messages = await Message.find(messageQuery)
            .sort(after !== undefined ? { seq: 1 } : { seq: -1, createdAt: -1 })
            .limit(limit)
            .populate<{ replyTo: QuotedMessage | null }>({
                path: "replyTo",
                select: "message mediaType mediaUrl senderId e2ee",
            })
            .lean();

        // Decrypt what the server encrypted; end-to-end text stays as it is
        const decryptedMessages = messages.map((msg) => {
            const decryptedMsg = { ...msg, message: outgoingText(msg) };
            if (decryptedMsg.replyTo) {
                decryptedMsg.replyTo.message = outgoingText(decryptedMsg.replyTo);
            }
            return decryptedMsg;
        });

        res.status(200).json(decryptedMessages);
    } catch (error) {
        console.error("Error in getMessages controller:", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const markMessagesAsRead = async (req: ValidatedRequest<typeof conversationIdSchema>, res: Response) => {
    try {
        const { id: conversationId } = req.params;
        const userId = req.user._id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(userId)) {
            return res.status(404).json({
                error: "Conversation not found or you are not a member.",
            });
        }

        // Everything up to the newest message is read. Browsers mark their
        // own messages read up to this number.
        const upToSeq = conversation.lastSeq ?? undefined;

        await Message.updateMany(
            {
                receiverId: conversationId,
                senderId: { $ne: userId },
                status: { $ne: "read" },
                ...(upToSeq !== undefined && { seq: { $lte: upToSeq } }),
            },
            {
                $set: { status: "read" },
            },
        );

        // Not a new message, so the chat keeps its place in the list
        await Conversation.updateOne(
            { _id: conversation._id },
            { $set: { [`unread.${userId.toString()}`]: 0 } },
            { timestamps: false },
        );

        emitToChat(conversation, "messagesRead", { conversationId, userId, upToSeq }, userId);

        res.status(200).json({ message: "Messages marked as read" });
    } catch (error) {
        console.error("Error in markMessagesAsRead controller:", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};
