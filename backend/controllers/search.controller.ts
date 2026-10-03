import type { Response } from "express";
import type { ValidatedRequest } from "../middleware/validate.ts";
import type { searchMessagesSchema } from "../validation/schemas.ts";
import { errorMessage } from "../utils/errorMessage.ts";
import Conversation from "../models/conversation.model.ts";
import Message from "../models/message.model.ts";
import type { PublicUser } from "../models/user.model.ts";
import { decryptText } from "../utils/encryption.ts";
import { matchesQuery, queryTokensFor } from "../utils/searchIndex.ts";
import { notExpired } from "../utils/expiry.ts";

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
            ...notExpired(),
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
