import filter from "leo-profanity";
import { currentIdentity } from "./identity";
import { decryptText, encryptText, newChatKey, openChatKey, sealChatKey, type SealedKey } from "./crypto";
import type { ApiError, E2eeFields, MediaSecret, Message, QuotedMessage } from "../../types";

// Encrypting and decrypting chat messages. A chat goes end to end once
// every member has a key; from then on the server refuses plain text in it.
// The browser that finds the chat's newest key out of date (no key yet,
// or members or their keys changed) makes a new one and sends it along
// with its message.

filter.loadDictionary("en");

// GET /api/keys/chats/:id
interface ChatKeyInfo {
    conversationId: string | null;
    ready: boolean;
    epoch: number | null;
    // The newest key still has one copy per current member
    current: boolean;
    members: { _id: string; publicKey: string | null; keyVersion: number | null }[];
    // This user's copies of each chat key
    keys: (SealedKey & { epoch: number; keyVersion: number })[];
}

export interface NewChatKey {
    epoch: number;
    envelopes: (SealedKey & { userId: string; keyVersion: number })[];
}

// The text fields of a send or edit request
export interface SealedFields {
    message: string;
    e2ee?: E2eeFields;
    newKey?: NewChatKey;
}

export class LockedError extends Error {
    constructor() {
        super("Unlock encryption to send messages.");
    }
}

// An encrypted attachment can't go to a chat that isn't end to end
export class NotEncryptedError extends Error {
    constructor() {
        super("This chat is no longer encrypted. Attach the file again.");
    }
}

// Keyed by the id the browser asked with: a chat id, or a user id for a new chat
const infoCache = new Map<string, Promise<ChatKeyInfo>>();
const chatKeys = new Map<string, Promise<CryptoKey | null>>();

const fetchInfo = async (id: string) => {
    const res = await fetch(`/api/keys/chats/${id}`);
    const data = (await res.json()) as ChatKeyInfo & ApiError;
    if (!res.ok) throw new Error(data.error || "Couldn't load this chat's keys");
    return data;
};

const chatInfo = (id: string, fresh = false) => {
    let info = fresh ? undefined : infoCache.get(id);
    if (!info) {
        info = fetchInfo(id);
        infoCache.set(id, info);
        info.catch(() => infoCache.delete(id));
    }
    return info;
};

// Whether new messages to this chat are end-to-end encrypted
export const isEndToEnd = async (id: string) => (await chatInfo(id)).ready;

// The members of a chat that have a key, for comparing safety numbers
export const chatKeyHolders = async (id: string) =>
    (await chatInfo(id)).members.flatMap((member) =>
        member.publicKey ? [{ _id: member._id, publicKey: member.publicKey }] : [],
    );

// After a 409 or a membership change, the next send asks again
export const forgetChatInfo = (id?: string) => {
    if (id) infoCache.delete(id);
    else infoCache.clear();
};

export const forgetChatKeys = () => {
    infoCache.clear();
    chatKeys.clear();
};

// The chat key of one epoch, opened with this browser's private key
const chatKey = (conversationId: string, epoch: number) => {
    const identity = currentIdentity();
    if (!identity) return Promise.resolve(null);
    const cacheKey = `${identity.keyVersion}:${conversationId}:${epoch}`;
    let key = chatKeys.get(cacheKey);
    if (!key) {
        key = (async () => {
            const mine = (info: ChatKeyInfo) =>
                info.keys.find((k) => k.epoch === epoch && k.keyVersion === identity.keyVersion);
            // A key newer than the cached list means someone just made it
            const sealed = mine(await chatInfo(conversationId)) ?? mine(await chatInfo(conversationId, true));
            return sealed ? openChatKey(sealed, identity.privateKey) : null;
        })();
        chatKeys.set(cacheKey, key);
        key.catch(() => chatKeys.delete(cacheKey));
    }
    return key;
};

const sealText = async (key: CryptoKey, epoch: number, text: string, media?: MediaSecret) => {
    const { ciphertext, iv } = await encryptText(key, text);
    const e2ee: E2eeFields = { epoch, iv };
    if (media) {
        const sealed = await encryptText(key, JSON.stringify(media));
        e2ee.media = { epoch, iv: sealed.iv, data: sealed.ciphertext };
    }
    return { message: ciphertext, e2ee };
};

// Prepares the text of a message for a chat. Plain until the chat is end
// to end; after that it's filtered for profanity here (the server can't)
// and encrypted, with a new chat key when the newest one is out of date.
// `media` is the key of an attachment that was encrypted before upload.
export const sealForChat = async (
    id: string,
    text: string,
    { fresh = false, media }: { fresh?: boolean; media?: MediaSecret } = {},
): Promise<SealedFields> => {
    const info = await chatInfo(id, fresh);
    if (!info.ready) {
        if (media) throw new NotEncryptedError();
        return { message: text };
    }

    const identity = currentIdentity();
    if (!identity) throw new LockedError();
    const clean = text ? filter.clean(text) : "";

    if (info.current && info.conversationId && info.epoch) {
        const key = await chatKey(info.conversationId, info.epoch);
        if (key) return sealText(key, info.epoch, clean, media);
    }

    const key = await newChatKey();
    const epoch = (info.epoch ?? 0) + 1;
    const envelopes = await Promise.all(
        info.members.map(async (member) => {
            if (!member.publicKey || member.keyVersion == null) throw new Error("A member has no key");
            return { userId: member._id, keyVersion: member.keyVersion, ...(await sealChatKey(key, member.publicKey)) };
        }),
    );
    const sealed = await sealText(key, epoch, clean, media);
    // The next message picks up the saved key from the server
    forgetChatInfo(id);
    if (info.conversationId) forgetChatInfo(info.conversationId);
    return { ...sealed, newKey: { epoch, envelopes } };
};

const openText = async (conversationId: string, e2ee: Pick<E2eeFields, "epoch" | "iv">, ciphertext: string) => {
    try {
        const key = await chatKey(conversationId, e2ee.epoch);
        return key ? await decryptText(key, { ciphertext, iv: e2ee.iv }) : null;
    } catch {
        return null;
    }
};

const openPart = async <T extends Message | QuotedMessage>(conversationId: string, part: T): Promise<T> => {
    if (!part.e2ee) return part;
    const text = await openText(conversationId, part.e2ee, part.message);
    const { e2ee: sealed, ...rest } = part;
    const opened =
        text === null
            ? ({ ...rest, message: "", undecryptable: true } as T)
            : ({ ...rest, message: text, endToEnd: true } as T);
    if (sealed.media) {
        const details = await openText(conversationId, sealed.media, sealed.media.data);
        try {
            if (details === null) throw new Error("No key");
            opened.media = JSON.parse(details) as MediaSecret;
        } catch {
            opened.mediaLocked = true;
        }
    }
    return opened;
};

// Decrypts a message from the server, and the message it quotes. Anything
// without ciphertext comes back as it was.
export const openMessage = async (message: Message): Promise<Message> => {
    if (!message.e2ee && !message.replyTo?.e2ee) return message;
    const opened = await openPart(message.receiverId, message);
    if (opened.replyTo) opened.replyTo = await openPart(message.receiverId, opened.replyTo);
    return opened;
};

export const openMessages = (messages: Message[]) => Promise.all(messages.map(openMessage));

// Sends a request carrying sealed text. If the server says the chat's keys
// changed in the meantime, it seals the text again with fresh keys and
// sends once more.
export const sendSealed = async (
    id: string,
    text: string,
    send: (fields: SealedFields) => Promise<Response>,
    media?: MediaSecret,
) => {
    const res = await send(await sealForChat(id, text, { media }));
    if (res.status !== 409) return res;
    const body = (await res
        .clone()
        .json()
        .catch(() => ({}))) as { code?: string };
    if (body.code !== "keys_changed") return res;
    forgetChatInfo(id);
    return send(await sealForChat(id, text, { fresh: true, media }));
};
