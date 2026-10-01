import type { Request, Response } from "express";
import type { ValidatedRequest } from "../middleware/validate.ts";
import type {
    conversationIdSchema,
    editMessageSchema,
    getMessagesSchema,
    magicReplySchema,
    messageIdSchema,
    reactionSchema,
    searchMessagesSchema,
    sendMessageSchema,
} from "../validation/schemas.ts";
import { errorMessage } from "../utils/errorMessage.ts";
import Conversation from "../models/conversation.model.ts";
import type { QueryFilter } from "mongoose";
import Message, {
    type MessageDocument,
    type MessageFields,
    type QuotedMessage,
} from "../models/message.model.ts";
import User, { type PublicUser } from "../models/user.model.ts";
import { emitToChat, isOnline } from "../socket/socket.ts";
import { encryptText, decryptText } from "../utils/encryption.ts";
import { cleanProfanity } from "../utils/profanityFilter.ts";
import { messageNotification, sendPushToUsers } from "../utils/push.ts";
import { matchesQuery, queryTokensFor, searchTokensFor } from "../utils/searchIndex.ts";
import { appendMessage, ensureSequenced } from "../utils/sequence.ts";

// Messages go out with the sender's profile and the message they reply to
const WITH_SENDER_AND_REPLY = [
    { path: "senderId", select: "fullName profilePic username isPublic" },
    { path: "replyTo", select: "message mediaType mediaUrl senderId" },
];
type WithSenderAndReply = { senderId: PublicUser; replyTo: QuotedMessage | null };

// Decrypts a saved message and the message it quotes, ready to send out
const readableMessage = async (message: MessageDocument) => {
    const populated = await message.populate<WithSenderAndReply>(WITH_SENDER_AND_REPLY);
    if (populated.message) {
        populated.message = decryptText(populated.message);
    }
    if (populated.replyTo && populated.replyTo.message) {
        populated.replyTo.message = decryptText(populated.replyTo.message);
    }
    return populated;
};

type ReadableMessage = Awaited<ReturnType<typeof readableMessage>>;

const isDuplicateKeyError = (error: unknown) =>
    (error as { code?: number }).code === 11000;

export const sendMessage = async (req: ValidatedRequest<typeof sendMessageSchema>, res: Response) => {
    try {
        // Checked by sendMessageSchema. System messages are only made by the server.
        const { message, mediaUrl, mediaType, replyTo, isCall, isForwarded, clientId } = req.body;
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
        if (replyTo && !conversation.messages.some((id) => id.equals(replyTo))) {
            return res
                .status(400)
                .json({ error: "You can only reply to messages in this chat." });
        }

        const cleanedText = message ? cleanProfanity(message) : "";

        const newMessage = new Message({
            senderId,
            receiverId: conversation._id,
            clientId,
            message: cleanedText ? encryptText(cleanedText) : "",
            searchTokens: cleanedText ? searchTokensFor(cleanedText) : undefined,
            mediaUrl: mediaUrl || null,
            mediaType,
            replyTo: replyTo || null,
            isCall,
            isForwarded,
        });

        newMessage.seq = await appendMessage(conversation._id, newMessage._id);
        try {
            await newMessage.save();
        } catch (error) {
            // Two copies of the same send arrived at once and the other one
            // won: drop this one from the chat and answer with the winner
            if (!clientId || !isDuplicateKeyError(error)) throw error;
            await Conversation.updateOne(
                { _id: conversation._id },
                { $pull: { messages: newMessage._id } },
            );
            const winner = await Message.findOne({ senderId, clientId });
            if (!winner) throw error;
            return respond(200, await readableMessage(winner));
        }

        const populatedMessage = await readableMessage(newMessage);

        emitToChat(conversation, "newMessage", populatedMessage, senderId);

        // People with no open tab get a push notification instead
        const others = conversation.participants.filter((p) => !p.equals(senderId));
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

        const messageQuery: QueryFilter<MessageFields> = { _id: { $in: conversation.messages } };

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
                select: "message mediaType mediaUrl senderId",
            })
            .lean();

        // Decrypt all messages before sending to client
        const decryptedMessages = messages.map((msg) => {
            const decryptedMsg = {
                ...msg,
                message: msg.message ? decryptText(msg.message) : "",
            };
            if (decryptedMsg.replyTo && decryptedMsg.replyTo.message) {
                decryptedMsg.replyTo.message = decryptText(
                    decryptedMsg.replyTo.message,
                );
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

        emitToChat(conversation, "messagesRead", { conversationId, userId, upToSeq }, userId);

        res.status(200).json({ message: "Messages marked as read" });
    } catch (error) {
        console.error("Error in markMessagesAsRead controller:", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const addReaction = async (req: ValidatedRequest<typeof reactionSchema>, res: Response) => {
    try {
        const { messageId } = req.params;
        const { reaction } = req.body;
        const userId = req.user._id;

        const [message, conversation] = await Promise.all([
            Message.findById(messageId),
            Conversation.findOne({ messages: messageId }),
        ]);

        // Treat messages in chats the user is not part of as missing
        if (!message || !conversation?.participants.includes(userId)) {
            return res.status(404).json({ error: "Message not found" });
        }

        const existingReactionIndex = message.reactions.findIndex(
            (r) =>
                r.userId.toString() === userId.toString() &&
                r.reaction === reaction,
        );

        if (existingReactionIndex !== -1) {
            message.reactions.splice(existingReactionIndex, 1);
        } else {
            const existingAnyReactionIndex = message.reactions.findIndex(
                (r) => r.userId.toString() === userId.toString(),
            );
            if (existingAnyReactionIndex !== -1) {
                message.reactions.splice(existingAnyReactionIndex, 1);
            }
            message.reactions.push({ userId, reaction });
        }

        await message.save();

        // Same shape as a new message, so the browser can swap it in whole
        const messageObj = await readableMessage(message);

        // Both people get it, so the reactor's other tabs update too
        emitToChat(conversation, "messageReaction", messageObj);

        res.status(200).json(messageObj);
    } catch (error) {
        console.error("Error in addReaction controller: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

// Groq's free tier allows 8K tokens a minute on this model, and one draft
// uses a few hundred, so the limit is not a problem at this app's scale.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export const generateMagicReply = async (req: ValidatedRequest<typeof magicReplySchema>, res: Response) => {
    try {
        const { messages, requestedTone } = req.body;

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: "Groq API key is missing." });
        }
        // magicReplySchema keeps only the last 10 messages, 500 characters
        // each, so a single draft stays well under the token limit
        const conversationContext = messages
            .map((msg) => `${msg.sender}: ${msg.text}`)
            .join("\n");

        const toneRule =
            requestedTone !== "Auto"
                ? `Use this tone: ${requestedTone}. Follow it strictly.`
                : "Match the tone, formality and style of the conversation.";

        const response = await fetch(GROQ_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `You help a user write their next message in a chat app. The user is "Me". Write only the next message "Me" should send: short, natural and fitting the conversation. Return the exact text to send, with no quotes, labels or extra commentary. ${toneRule}`,
                    },
                    { role: "user", content: conversationContext },
                ],
                reasoning_effort: "low",
                include_reasoning: false,
                max_completion_tokens: 512,
                temperature: 0.7,
            }),
            signal: AbortSignal.timeout(20000),
        });

        if (!response.ok) {
            const detail = await response.text();
            console.error("Groq error:", response.status, detail);
            if (response.status === 429) {
                return res
                    .status(429)
                    .json({ error: "Too many AI requests right now. Try again in a minute." });
            }
            return res.status(502).json({ error: "Failed to generate reply" });
        }

        const data = (await response.json()) as {
            choices?: { message?: { content?: string } }[];
        };
        const replyText = (data.choices?.[0]?.message?.content || "")
            .trim()
            .replace(/^["']|["']$/g, "");

        if (!replyText) {
            return res.status(502).json({ error: "Failed to generate reply" });
        }

        res.json({ reply: replyText });
    } catch (error) {
        console.error("Error generating magic reply:", error);
        res.status(500).json({ error: "Failed to generate reply" });
    }
};

export const editMessage = async (req: ValidatedRequest<typeof editMessageSchema>, res: Response) => {
    try {
        const { messageId } = req.params;
        const { message: newText } = req.body;
        const userId = req.user._id;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const cleanedText = newText ? cleanProfanity(newText) : "";
        message.message = encryptText(cleanedText);
        message.searchTokens = searchTokensFor(cleanedText);
        message.isEdited = true;
        await message.save();

        const messageObj = await message.populate<WithSenderAndReply>(WITH_SENDER_AND_REPLY);

        const populatedObj = messageObj.toObject();
        delete populatedObj.searchTokens;
        if (populatedObj.message) {
            populatedObj.message = decryptText(populatedObj.message);
        }
        if (populatedObj.replyTo && populatedObj.replyTo.message) {
            populatedObj.replyTo.message = decryptText(populatedObj.replyTo.message);
        }

        const conversation = await Conversation.findOne({
            messages: messageId,
        });

        if (conversation) {
            emitToChat(conversation, "messageEdited", populatedObj, userId);
        }

        res.status(200).json(populatedObj);
    } catch (error) {
        console.error("Error in editMessage controller: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteMessage = async (req: ValidatedRequest<typeof messageIdSchema>, res: Response) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        message.isDeleted = true;
        message.message = encryptText("This message was deleted");
        message.searchTokens = undefined;
        await message.save();

        const messageObj = await message.populate<WithSenderAndReply>(WITH_SENDER_AND_REPLY);

        const populatedObj = messageObj.toObject();
        populatedObj.message = "This message was deleted";
        if (populatedObj.replyTo && populatedObj.replyTo.message) {
            populatedObj.replyTo.message = decryptText(populatedObj.replyTo.message);
        }

        const conversation = await Conversation.findOne({
            messages: messageId,
        });

        if (conversation) {
            emitToChat(conversation, "messageDeleted", populatedObj, userId);
        }

        res.status(200).json(populatedObj);
    } catch (error) {
        console.error("Error in deleteMessage controller: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

// Searches the text of every chat the user is in, newest first. Works on
// the blind index, then decrypts the hits and checks them again.
export const searchMessages = async (req: ValidatedRequest<typeof searchMessagesSchema>, res: Response) => {
    try {
        const { q, limit } = req.query;
        const tokens = queryTokensFor(q);
        if (tokens.length === 0) return res.status(200).json([]);

        const conversations = await Conversation.find({ participants: req.user._id }).select("_id").lean();

        const candidates = await Message.find({
            receiverId: { $in: conversations.map((c) => c._id) },
            searchTokens: { $all: tokens },
            isDeleted: { $ne: true },
        })
            .sort({ createdAt: -1 })
            .limit(limit * 2)
            .populate<{ senderId: PublicUser }>("senderId", "fullName profilePic username")
            .lean();

        const results = candidates
            .map((m) => ({ ...m, message: decryptText(m.message) }))
            .filter((m) => matchesQuery(m.message, q))
            .slice(0, limit)
            .map((m) => ({
                _id: m._id,
                conversationId: m.receiverId,
                message: m.message,
                createdAt: m.createdAt,
                sender: m.senderId,
            }));

        res.status(200).json(results);
    } catch (error) {
        console.error("Error in searchMessages controller: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};
