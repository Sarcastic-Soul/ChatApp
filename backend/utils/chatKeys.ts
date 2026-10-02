import type { Types } from "mongoose";
import ChatKey from "../models/chatKey.model.ts";
import Conversation from "../models/conversation.model.ts";
import User from "../models/user.model.ts";

// Rules for end-to-end encrypted chats. The server can't read the keys or
// the messages, but it decides when a chat must use them and which chat
// key is current, so a removed member never gets a copy of a new key.

type ChatForKeys = {
    _id: Types.ObjectId;
    participants: Types.ObjectId[];
    keyEpoch?: number | null;
};

type MemberKey = { _id: Types.ObjectId; publicKey?: string | null; keyVersion?: number | null };
type EnvelopeRef = { userId: Types.ObjectId | string; keyVersion: number };

export type Envelope = {
    userId: string;
    keyVersion: number;
    ephemeralKey: string;
    iv: string;
    wrappedKey: string;
};
export type NewChatKey = { epoch: number; envelopes: Envelope[] };
export type E2eeFields = { epoch: number; iv: string };

export const memberKeys = (participants: Types.ObjectId[]): Promise<MemberKey[]> =>
    User.find({ _id: { $in: participants } })
        .select("publicKey keyVersion")
        .lean();

// Once every member has a key, new messages in the chat must be end-to-end
// encrypted. Until then they use the server's encryption.
export const everyoneHasKeys = (members: MemberKey[]) =>
    members.length > 0 && members.every((m) => m.publicKey && m.keyVersion != null);

// A chat key is good only while it holds one copy for each current member,
// made for that member's current key. Anyone added, removed or with a reset
// key means the next sender has to make a new one.
export const coversMembers = (envelopes: EnvelopeRef[], members: MemberKey[]) => {
    if (envelopes.length !== members.length) return false;
    const versions = new Map(members.map((m) => [m._id.toString(), m.keyVersion]));
    const seen = new Set<string>();
    for (const envelope of envelopes) {
        const id = envelope.userId.toString();
        if (seen.has(id) || versions.get(id) !== envelope.keyVersion) return false;
        seen.add(id);
    }
    return true;
};

export const currentChatKey = (conversation: ChatForKeys) =>
    conversation.keyEpoch == null
        ? null
        : ChatKey.findOne({ conversationId: conversation._id, epoch: conversation.keyEpoch }).lean();

const isDuplicateKeyError = (error: unknown) => (error as { code?: number }).code === 11000;

// Why a message was refused; null from checkChatKey means it can be saved
export type KeyRefusal = { status: number; error: string; code: "keys_changed" };

const keysChanged: KeyRefusal = {
    status: 409,
    error: "This chat's encryption keys changed. Try again.",
    code: "keys_changed",
};

// Checks a message against the chat's keys before it's saved. A browser
// that found the current key out of date sends a new one with the message;
// it's saved first, and only if it's the next epoch and covers every member.
// Any mismatch is a 409, and the browser fetches the keys again and retries.
export const checkChatKey = async ({
    conversation,
    senderId,
    e2ee,
    newKey,
    plainAllowed = false,
}: {
    conversation: ChatForKeys;
    senderId: Types.ObjectId;
    e2ee?: E2eeFields;
    newKey?: NewChatKey;
    // Call logs stay readable by the server, like call signaling itself
    plainAllowed?: boolean;
}): Promise<KeyRefusal | null> => {
    const members = await memberKeys(conversation.participants);
    const ready = everyoneHasKeys(members);

    if (newKey) {
        if (!ready || newKey.epoch !== (conversation.keyEpoch ?? 0) + 1) return keysChanged;
        if (!coversMembers(newKey.envelopes, members)) return keysChanged;
        try {
            await ChatKey.create({ conversationId: conversation._id, createdBy: senderId, ...newKey });
        } catch (error) {
            if (isDuplicateKeyError(error)) return keysChanged;
            throw error;
        }
        await Conversation.updateOne({ _id: conversation._id }, { $max: { keyEpoch: newKey.epoch } });
        conversation.keyEpoch = Math.max(conversation.keyEpoch ?? 0, newKey.epoch);
    }

    if (!e2ee) return ready && !plainAllowed ? keysChanged : null;

    if (!ready || e2ee.epoch !== conversation.keyEpoch) return keysChanged;
    const current = await currentChatKey(conversation);
    if (!current || !coversMembers(current.envelopes, members)) return keysChanged;
    return null;
};
