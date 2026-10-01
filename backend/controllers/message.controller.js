import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { getReceiverSocketId, io } from "../socket/socket.js";
import { encryptText, decryptText } from "../utils/encryption.js";
import { cleanProfanity } from "../utils/profanityFilter.js";

export const sendMessage = async (req, res) => {
    try {
        // Checked by sendMessageSchema. System messages are only made by the server.
        const { message, mediaUrl, mediaType, replyTo, isCall, isForwarded } = req.body;
        const { id: conversationIdOrUserId } = req.params;
        const senderId = req.user._id;

        let isNewConversation = false;
        let conversation = await Conversation.findById(conversationIdOrUserId);

        if (!conversation) {
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
                isNewConversation = true;
            }
        }

        if (!conversation.participants.includes(senderId)) {
            return res.status(403).json({
                error: "You are not a participant in this conversation.",
            });
        }

        const cleanedText = message ? cleanProfanity(message) : "";

        const newMessage = new Message({
            senderId,
            receiverId: conversation._id,
            message: cleanedText ? encryptText(cleanedText) : "",
            mediaUrl: mediaUrl || null,
            mediaType,
            replyTo: replyTo || null,
            isCall,
            isForwarded,
        });

        conversation.messages.push(newMessage._id);

        await Promise.all([conversation.save(), newMessage.save()]);

        const populatedMessage = await newMessage.populate([
            {
                path: "senderId",
                select: "fullName profilePic username isPublic",
            },
            { path: "replyTo", select: "message mediaType mediaUrl senderId" },
        ]);

        // Decrypt message before sending to sockets/frontend
        if (populatedMessage.message) {
            populatedMessage.message = decryptText(populatedMessage.message);
        }
        if (populatedMessage.replyTo && populatedMessage.replyTo.message) {
            populatedMessage.replyTo.message = decryptText(
                populatedMessage.replyTo.message,
            );
        }

        if (conversation.isGroupChat) {
            io.to(conversation._id.toString()).emit(
                "newMessage",
                populatedMessage,
            );
        } else {
            const receiverId = conversation.participants.find(
                (p) => p.toString() !== senderId.toString(),
            );
            const receiverSocketId = getReceiverSocketId(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("newMessage", populatedMessage);
            }
        }

        if (isNewConversation) {
            const populatedConv = await conversation.populate(
                "participants",
                "fullName profilePic username isPublic",
            );
            return res.status(201).json({
                newMessage: populatedMessage,
                newConversation: populatedConv,
            });
        }

        res.status(201).json({ newMessage: populatedMessage });
    } catch (error) {
        console.error("Error in sendMessage controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getMessages = async (req, res) => {
    try {
        const { id: conversationId } = req.params;
        const { before, limit } = req.query;
        const senderId = req.user._id;

        const conversation = await Conversation.findById(conversationId);

        if (!conversation || !conversation.participants.includes(senderId)) {
            return res.status(404).json({
                error: "Conversation not found or you are not a member.",
            });
        }

        let messageQuery = { _id: { $in: conversation.messages } };

        if (before) {
            const beforeMsg = await Message.findById(before);
            if (beforeMsg) {
                messageQuery.createdAt = { $lt: beforeMsg.createdAt };
            }
        }

        const messages = await Message.find(messageQuery)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate({
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
        console.error("Error in getMessages controller:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const markMessagesAsRead = async (req, res) => {
    try {
        const { id: conversationId } = req.params;
        const userId = req.user._id;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(userId)) {
            return res.status(404).json({
                error: "Conversation not found or you are not a member.",
            });
        }

        await Message.updateMany(
            {
                receiverId: conversationId,
                senderId: { $ne: userId },
                status: { $ne: "read" },
            },
            {
                $set: { status: "read" },
            },
        );

        if (conversation.isGroupChat) {
            io.to(conversationId).emit("messagesRead", {
                conversationId,
                userId,
            });
        } else {
            const otherParticipantId = conversation.participants.find(
                (p) => p.toString() !== userId.toString(),
            );
            const senderSocketId = getReceiverSocketId(otherParticipantId);
            if (senderSocketId) {
                io.to(senderSocketId).emit("messagesRead", {
                    conversationId,
                    userId,
                });
            }
        }

        res.status(200).json({ message: "Messages marked as read" });
    } catch (error) {
        console.error("Error in markMessagesAsRead controller:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const addReaction = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { reaction } = req.body;
        const userId = req.user._id;

        const message = await Message.findById(messageId);

        if (!message) {
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

        const messageObj = message.toObject();
        if (messageObj.message) {
            messageObj.message = decryptText(messageObj.message);
        }

        const conversation = await Conversation.findOne({
            messages: messageId,
        });

        if (conversation) {
            const receiverId = conversation.participants.find(
                (p) => p.toString() !== userId.toString(),
            );
            const receiverSocketId = getReceiverSocketId(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("messageReaction", messageObj);
            }

            const senderSocketId = getReceiverSocketId(userId);
            if (senderSocketId && senderSocketId !== receiverSocketId) {
                io.to(senderSocketId).emit("messageReaction", messageObj);
            }
        }

        res.status(200).json(messageObj);
    } catch (error) {
        console.error("Error in addReaction controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Groq's free tier allows 8K tokens a minute on this model, and one draft
// uses a few hundred, so the limit is not a problem at this app's scale.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

export const generateMagicReply = async (req, res) => {
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

        const data = await response.json();
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

export const editMessage = async (req, res) => {
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
        message.isEdited = true;
        await message.save();

        const messageObj = await message.populate([
            {
                path: "senderId",
                select: "fullName profilePic username isPublic",
            },
            { path: "replyTo", select: "message mediaType mediaUrl senderId" },
        ]);

        const populatedObj = messageObj.toObject();
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
            if (conversation.isGroupChat) {
                io.to(conversation._id.toString()).emit("messageEdited", populatedObj);
            } else {
                const receiverId = conversation.participants.find(
                    (p) => p.toString() !== userId.toString(),
                );
                const receiverSocketId = getReceiverSocketId(receiverId);
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit("messageEdited", populatedObj);
                }
            }
        }

        res.status(200).json(populatedObj);
    } catch (error) {
        console.error("Error in editMessage controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteMessage = async (req, res) => {
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
        await message.save();

        const messageObj = await message.populate([
            {
                path: "senderId",
                select: "fullName profilePic username isPublic",
            },
            { path: "replyTo", select: "message mediaType mediaUrl senderId" },
        ]);

        const populatedObj = messageObj.toObject();
        populatedObj.message = "This message was deleted";
        if (populatedObj.replyTo && populatedObj.replyTo.message) {
            populatedObj.replyTo.message = decryptText(populatedObj.replyTo.message);
        }

        const conversation = await Conversation.findOne({
            messages: messageId,
        });

        if (conversation) {
            if (conversation.isGroupChat) {
                io.to(conversation._id.toString()).emit("messageDeleted", populatedObj);
            } else {
                const receiverId = conversation.participants.find(
                    (p) => p.toString() !== userId.toString(),
                );
                const receiverSocketId = getReceiverSocketId(receiverId);
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit("messageDeleted", populatedObj);
                }
            }
        }

        res.status(200).json(populatedObj);
    } catch (error) {
        console.error("Error in deleteMessage controller: ", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
