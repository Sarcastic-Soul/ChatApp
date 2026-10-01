import { GoogleGenAI } from "@google/genai";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { getReceiverSocketId, io } from "../socket/socket.js";
import { encryptText, decryptText } from "../utils/encryption.js";
import { cleanProfanity } from "../utils/profanityFilter.js";

export const sendMessage = async (req, res) => {
    try {
        const { message, mediaUrl, mediaType, replyTo, isCall, isForwarded, isSystem } = req.body;
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
            mediaType: mediaType || "text",
            replyTo: replyTo || null,
            isCall: isCall || false,
            isForwarded: isForwarded || false,
            isSystem: isSystem || false,
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
        const { before, limit = 50 } = req.query;
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
            .limit(parseInt(limit))
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

export const generateMagicReply = async (req, res) => {
    try {
        const { messages, requestedTone } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res
                .status(500)
                .json({ error: "Gemini API key is missing." });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const conversationContext = messages
            .map((msg) => `${msg.sender}: ${msg.text}`)
            .join("\n");

        let prompt = `You are helping a user write a reply in a chat app.

Here is the recent conversation history:
${conversationContext}

Instructions:
1. Write the NEXT message that "Me" (the user) should send.
2. The response should be concise, natural, and fit the flow of the conversation.
3. DO NOT wrap the response in quotes or add conversational filler. Just return the exact text to be sent.
`;

        if (requestedTone && requestedTone !== "Auto") {
            prompt += `4. The user has specifically requested this tone/action: [${requestedTone}]. You MUST follow this tone strictly.`;
        } else {
            prompt += `4. No specific tone was requested. Analyze the conversation history and MATCH the existing tone, formality, and style of the chat.`;
        }

        const result = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            contents: prompt,
        });
        let replyText = (result.text || "").trim();

        replyText = replyText.replace(/^["']|["']$/g, "");

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
