import type { Types } from "mongoose";
import Conversation from "../models/conversation.model.ts";
import Message from "../models/message.model.ts";

type Id = Types.ObjectId | string;

// Chats made before sequence numbers existed get them the first time they
// are used: their messages are numbered in the order they were sent. Two
// calls at once write the same numbers, and only one sets lastSeq.
export const ensureSequenced = async (conversationId: Id) => {
    const conversation = await Conversation.findById(conversationId, "lastSeq").lean();
    if (!conversation || conversation.lastSeq != null) return;

    const messages = await Message.find({ receiverId: conversationId }, "_id")
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

// Takes the next sequence number of a chat. One atomic update, so two
// messages sent at the same moment never share a number.
export const nextSeq = async (conversationId: Id) => {
    await ensureSequenced(conversationId);
    const conversation = await Conversation.findByIdAndUpdate(
        conversationId,
        { $inc: { lastSeq: 1 } },
        { returnDocument: "after", projection: { lastSeq: 1 } },
    );
    if (!conversation?.lastSeq) throw new Error("Conversation not found");
    return conversation.lastSeq;
};

// Records a saved message on its chat: it becomes the chat list preview,
// and counts as unread for the given members. The preview only moves
// forward, so two sends finishing out of order can't leave an older one.
export const recordMessage = async (
    conversationId: Id,
    message: { _id: Types.ObjectId; seq: number },
    unreadFor: Id[] = [],
) => {
    await Conversation.bulkWrite([
        {
            updateOne: {
                filter: {
                    _id: conversationId,
                    $or: [{ lastMessageSeq: { $lt: message.seq } }, { lastMessageSeq: null }],
                },
                update: { $set: { lastMessage: message._id, lastMessageSeq: message.seq } },
            },
        },
        ...(unreadFor.length
            ? [
                  {
                      updateOne: {
                          filter: { _id: conversationId },
                          update: {
                              $inc: Object.fromEntries(unreadFor.map((id) => [`unread.${id.toString()}`, 1])),
                          },
                      },
                  },
              ]
            : []),
    ]);
};
