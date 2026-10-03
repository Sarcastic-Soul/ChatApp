import type { Response } from "express";
import type { ValidatedRequest } from "../middleware/validate.ts";
import type { editMessageSchema, messageIdSchema, reactionSchema } from "../validation/schemas.ts";
import { errorMessage } from "../utils/errorMessage.ts";
import Conversation from "../models/conversation.model.ts";
import Message from "../models/message.model.ts";
import { emitToChat } from "../socket/socket.ts";
import { encryptText } from "../utils/encryption.ts";
import { cleanProfanity } from "../utils/profanityFilter.ts";
import { searchTokensFor } from "../utils/searchIndex.ts";
import { checkChatKey } from "../utils/chatKeys.ts";
import {
    outgoingText,
    readableMessage,
    refuseKeys,
    WITH_SENDER_AND_REPLY,
    type WithSenderAndReply,
} from "../utils/outgoing.ts";

// Changing a message that was already sent: reactions, edits and deletes

export const addReaction = async (req: ValidatedRequest<typeof reactionSchema>, res: Response) => {
    try {
        const { messageId } = req.params;
        const { reaction } = req.body;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        const conversation = message && (await Conversation.findById(message.receiverId));

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

export const editMessage = async (req: ValidatedRequest<typeof editMessageSchema>, res: Response) => {
    try {
        const { messageId } = req.params;
        const { message: newText, e2ee, newKey } = req.body;
        const userId = req.user._id;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ error: "Unauthorized" });
        }

        const conversation = await Conversation.findById(message.receiverId);

        // The new text follows the chat's current rules, so an edit in a
        // chat that went end to end gets encrypted too
        if (conversation) {
            const refusal = await checkChatKey({
                conversation,
                senderId: userId,
                e2ee,
                newKey,
                plainAllowed: message.isCall,
            });
            if (refusal) return refuseKeys(res, refusal);
        }

        if (e2ee) {
            message.message = newText;
            // An edit changes the text only; the attachment keeps its key
            message.e2ee = { epoch: e2ee.epoch, iv: e2ee.iv, media: message.e2ee?.media ?? undefined };
            message.searchTokens = undefined;
        } else {
            const cleanedText = cleanProfanity(newText);
            message.message = encryptText(cleanedText);
            message.e2ee = undefined;
            message.searchTokens = searchTokensFor(cleanedText);
        }
        message.isEdited = true;
        await message.save();

        const messageObj = await message.populate<WithSenderAndReply>(WITH_SENDER_AND_REPLY);

        const populatedObj = messageObj.toObject();
        delete populatedObj.searchTokens;
        populatedObj.message = outgoingText(populatedObj);
        if (populatedObj.replyTo) {
            populatedObj.replyTo.message = outgoingText(populatedObj.replyTo);
        }

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
        message.e2ee = undefined;
        message.searchTokens = undefined;
        message.mediaUrl = null;
        message.mediaType = "text";
        await message.save();

        const messageObj = await message.populate<WithSenderAndReply>(WITH_SENDER_AND_REPLY);

        const populatedObj = messageObj.toObject();
        populatedObj.message = "This message was deleted";
        if (populatedObj.replyTo) {
            populatedObj.replyTo.message = outgoingText(populatedObj.replyTo);
        }

        const conversation = await Conversation.findById(message.receiverId);

        if (conversation) {
            emitToChat(conversation, "messageDeleted", populatedObj, userId);
        }

        res.status(200).json(populatedObj);
    } catch (error) {
        console.error("Error in deleteMessage controller: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};
