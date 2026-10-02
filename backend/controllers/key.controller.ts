import type { Request, Response } from "express";
import type { Types } from "mongoose";
import ChatKey from "../models/chatKey.model.ts";
import Conversation from "../models/conversation.model.ts";
import User from "../models/user.model.ts";
import type { ValidatedRequest } from "../middleware/validate.ts";
import type { chatKeysSchema, setMyKeySchema } from "../validation/schemas.ts";
import { coversMembers, currentChatKey, everyoneHasKeys, memberKeys } from "../utils/chatKeys.ts";
import { errorMessage } from "../utils/errorMessage.ts";

// The logged-in user's key pair: the public key, plus the passphrase
// backup a new browser restores the private key from
export const getMyKey = async (req: Request, res: Response) => {
    try {
        const user = await User.findById(req.user._id).select("publicKey keyVersion +keyBackup").lean();
        if (!user?.publicKey) return res.status(200).json({ publicKey: null });
        res.status(200).json({
            publicKey: user.publicKey,
            keyVersion: user.keyVersion,
            backup: user.keyBackup ?? null,
        });
    } catch (error) {
        console.error("Error in getMyKey controller:", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

// Saves a new key pair. Replacing an existing one needs `reset`, because
// every end-to-end message made for the old key becomes unreadable.
export const setMyKey = async (req: ValidatedRequest<typeof setMyKeySchema>, res: Response) => {
    try {
        const { publicKey, backup, reset } = req.body;
        const user = await User.findById(req.user._id).select("publicKey keyVersion");
        if (!user) return res.status(404).json({ error: "User not found" });

        if (user.publicKey && !reset) {
            return res.status(409).json({ error: "Encryption is already set up for this account." });
        }

        user.publicKey = publicKey;
        user.keyVersion = (user.keyVersion ?? 0) + 1;
        user.keyBackup = backup;
        await user.save();

        res.status(200).json({ publicKey: user.publicKey, keyVersion: user.keyVersion });
    } catch (error) {
        console.error("Error in setMyKey controller:", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

// What a browser needs to encrypt for a chat and read it: every member's
// public key, whether the newest chat key still fits the members, and the
// logged-in user's own copy of each chat key. Like sending, the id is a
// chat id, or a user id for a one-on-one chat that may not exist yet.
export const getChatKeys = async (req: ValidatedRequest<typeof chatKeysSchema>, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        let conversation = await Conversation.findById(id);
        let participants: Types.ObjectId[];

        if (conversation) {
            if (!conversation.participants.includes(userId)) {
                return res.status(404).json({ error: "Conversation not found or you are not a member." });
            }
            participants = conversation.participants;
        } else {
            if (id === userId.toString()) {
                return res.status(400).json({ error: "You can't message yourself." });
            }
            conversation = await Conversation.findOne({
                isGroupChat: false,
                participants: { $all: [userId, id] },
            });
            if (conversation) {
                participants = conversation.participants;
            } else {
                const other = await User.findById(id).select("isPublic");
                if (!other) return res.status(404).json({ error: "User not found" });
                if (other.isPublic === false) {
                    return res.status(403).json({ error: "You cannot message a private user." });
                }
                participants = [userId, other._id];
            }
        }

        const members = await memberKeys(participants);
        const current = conversation ? await currentChatKey(conversation) : null;
        const mine = conversation
            ? await ChatKey.find(
                  { conversationId: conversation._id, "envelopes.userId": userId },
                  { epoch: 1, envelopes: { $elemMatch: { userId } } },
              )
                  .sort({ epoch: 1 })
                  .lean()
            : [];

        res.status(200).json({
            conversationId: conversation?._id ?? null,
            ready: everyoneHasKeys(members),
            epoch: conversation?.keyEpoch ?? null,
            current: Boolean(current && coversMembers(current.envelopes, members)),
            members: members.map((m) => ({
                _id: m._id,
                publicKey: m.publicKey ?? null,
                keyVersion: m.keyVersion ?? null,
            })),
            keys: mine.map(({ epoch, envelopes: [envelope] }) => ({
                epoch,
                keyVersion: envelope.keyVersion,
                ephemeralKey: envelope.ephemeralKey,
                iv: envelope.iv,
                wrappedKey: envelope.wrappedKey,
            })),
        });
    } catch (error) {
        console.error("Error in getChatKeys controller:", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};
