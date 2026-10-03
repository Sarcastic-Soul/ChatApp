import type { Response } from "express";
import type { ValidatedRequest } from "../middleware/validate.ts";
import type { disappearTimerSchema } from "../validation/schemas.ts";
import Conversation from "../models/conversation.model.ts";
import Message from "../models/message.model.ts";
import { emitToChat } from "../socket/socket.ts";
import { encryptText } from "../utils/encryption.ts";
import { errorMessage } from "../utils/errorMessage.ts";
import { includesId } from "../utils/ids.ts";
import { nextSeq, recordMessage } from "../utils/sequence.ts";

const LABELS: Record<number, string> = { 3600: "1 hour", 86400: "1 day", 604800: "7 days" };

// Turns disappearing messages on or off for a chat. Only messages sent
// after the change are affected. In a group only admins can change it.
export const setDisappearTimer = async (req: ValidatedRequest<typeof disappearTimerSchema>, res: Response) => {
    try {
        const { id: conversationId } = req.params;
        const { seconds } = req.body;
        const user = req.user;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(user._id)) {
            return res.status(404).json({ error: "Conversation not found or you are not a member." });
        }
        if (conversation.isGroupChat && !includesId(conversation.admins, user._id)) {
            return res.status(403).json({ error: "Only admins can change the disappearing messages timer." });
        }

        if ((conversation.disappearAfter ?? 0) !== seconds) {
            // A setting, not a new message: the chat keeps its place in the list
            await Conversation.updateOne(
                { _id: conversation._id },
                { $set: { disappearAfter: seconds } },
                { timestamps: false },
            );
            emitToChat(conversation, "chatTimer", { conversationId, disappearAfter: seconds });

            // The notice itself stays, so everyone can see when it changed.
            // Browsers show the sender's name in front of it.
            const text = seconds
                ? `set messages to disappear after ${LABELS[seconds]}`
                : "turned off disappearing messages";
            const seq = await nextSeq(conversation._id);
            const notice = await Message.create({
                senderId: user._id,
                receiverId: conversation._id,
                message: encryptText(text),
                isSystem: true,
                seq,
            });
            await recordMessage(conversation._id, { _id: notice._id, seq });
            const populated = await notice.populate("senderId", "fullName profilePic username isPublic");
            emitToChat(conversation, "newMessage", { ...populated.toObject(), message: text });
        }

        res.status(200).json({ conversationId, disappearAfter: seconds });
    } catch (error) {
        console.error("Error in setDisappearTimer controller: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};
