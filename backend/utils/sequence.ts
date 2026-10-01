import type { Types } from "mongoose";
import Conversation from "../models/conversation.model.ts";
import Message from "../models/message.model.ts";

type Id = Types.ObjectId | string;

// Chats made before sequence numbers existed get them the first time they
// are used: their messages are numbered in the order they were sent. Two
// calls at once write the same numbers, and only one sets lastSeq.
export const ensureSequenced = async (conversationId: Id) => {
    const conversation = await Conversation.findById(conversationId, "messages lastSeq").lean();
    if (!conversation || conversation.lastSeq != null) return;

    const messages = await Message.find({ _id: { $in: conversation.messages } }, "_id")
        .sort({ createdAt: 1, _id: 1 })
        .lean();
    if (messages.length) {
        await Message.bulkWrite(
            messages.map((message, index) => ({
                updateOne: { filter: { _id: message._id }, update: { $set: { seq: index + 1 } } },
            })),
        );
    }
    await Conversation.updateOne(
        { _id: conversationId, lastSeq: { $exists: false } },
        { $set: { lastSeq: messages.length } },
    );
};

// Adds a message to a chat and returns its sequence number. Taking the
// number and adding the id happen in one atomic update, so two messages
// sent at the same moment never share a number.
export const appendMessage = async (conversationId: Id, messageId: Types.ObjectId) => {
    await ensureSequenced(conversationId);
    const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        { $inc: { lastSeq: 1 }, $push: { messages: messageId } },
        { returnDocument: "after", projection: { lastSeq: 1 } },
    );
    if (!conversation?.lastSeq) throw new Error("Conversation not found");
    return conversation.lastSeq;
};
