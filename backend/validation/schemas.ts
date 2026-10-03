import { z } from "zod";
import { httpsUrl, objectId, requiredText } from "./fields.ts";

// Request schemas, grouped by route file. Each one lists the parts of the
// request it checks (params, query, body). Unknown fields are dropped.

const MAX_MESSAGE_LENGTH = 5000;
// AES-GCM ciphertext of a 5000-character message, as base64, with room for
// characters that take several bytes in UTF-8
const MAX_CIPHERTEXT_LENGTH = 28000;
const MAX_NAME_LENGTH = 50;

// bcrypt only uses the first 72 bytes of a password
const password = z
    .string({ error: "Password is required" })
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password must be 72 characters or fewer");

// ---------- auth ----------

export const signupSchema = {
    body: z
        .object({
            fullName: requiredText("Full name", MAX_NAME_LENGTH),
            username: z
                .string({ error: "Username is required" })
                .trim()
                .regex(
                    /^[a-zA-Z0-9._]{3,30}$/,
                    "Username must be 3 to 30 letters, numbers, dots or underscores",
                ),
            password,
            confirmPassword: z.string({ error: "Please confirm your password" }),
        })
        .refine((data) => data.password === data.confirmPassword, {
            path: ["confirmPassword"],
            error: "Passwords don't match",
        }),
};

export const loginSchema = {
    body: z.object({
        username: requiredText("Username", 100),
        password: z
            .string({ error: "Password is required" })
            .min(1, "Password is required")
            .max(72, "Invalid username or password"),
    }),
};

// ---------- end-to-end encryption ----------

// Keys and ciphertext travel as base64
const base64 = (label: string, max: number) =>
    z
        .string({ error: `${label} is required` })
        .max(max, `${label} is too long`)
        .regex(/^[A-Za-z0-9+/]+={0,2}$/, `${label} must be base64`);

const publicKey = base64("Public key", 200);

const envelope = z.object({
    userId: objectId("Member id"),
    keyVersion: z.number().int().min(1),
    ephemeralKey: publicKey,
    iv: base64("IV", 32),
    wrappedKey: base64("Wrapped key", 200),
});

// A new chat key, encrypted once for each member
const newChatKey = z.object({
    epoch: z.number().int().min(1),
    envelopes: z.array(envelope).min(1).max(101),
});

// What a browser needs to open an encrypted attachment (its key, type and a
// small preview), encrypted with the chat key of `epoch`
const sealedMedia = z.object({
    epoch: z.number().int().min(1),
    iv: base64("IV", 32),
    data: base64("Attachment details", 60000),
});

// Which chat key the text was encrypted with
const e2eeFields = z.object({
    epoch: z.number().int().min(1),
    iv: base64("IV", 32),
    media: sealedMedia.optional(),
});

export const setMyKeySchema = {
    body: z.object({
        publicKey,
        backup: z.object(
            {
                salt: base64("Salt", 64),
                iv: base64("IV", 32),
                data: base64("Backup", 1000),
                iterations: z.number().int().min(100_000).max(10_000_000),
            },
            { error: "A passphrase backup is required" },
        ),
        reset: z.boolean().default(false),
    }),
};

// ---------- messages ----------

const conversationParams = z.object({ id: objectId("Conversation id") });
const messageParams = z.object({ messageId: objectId("Message id") });

export const getMessagesSchema = {
    params: conversationParams,
    query: z.object({
        before: objectId("Cursor").optional(),
        // Sequence number of the newest message the browser already has
        after: z.coerce
            .number({ error: "After must be a number" })
            .int()
            .min(0, "After must be 0 or more")
            .optional(),
        limit: z.coerce
            .number({ error: "Limit must be a number" })
            .int()
            .min(1, "Limit must be between 1 and 100")
            .max(100, "Limit must be between 1 and 100")
            .default(50),
    }),
};

// The id is a conversation id, or a user id when starting a new 1-on-1 chat
export const chatKeysSchema = { params: conversationParams };

export const searchMessagesSchema = {
    query: z.object({
        q: requiredText("Search text", 100),
        limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
};

const tooLong = `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer`;

// Plain text has the usual length limit. End-to-end encrypted text is
// ciphertext, so it's checked as base64 instead.
const checkText = (data: { message: string; e2ee?: unknown }, ctx: z.RefinementCtx) => {
    if (!data.e2ee && data.message.length > MAX_MESSAGE_LENGTH) {
        ctx.addIssue({ code: "custom", path: ["message"], message: tooLong });
    }
    if (data.e2ee && !/^[A-Za-z0-9+/]+={0,2}$/.test(data.message)) {
        ctx.addIssue({ code: "custom", path: ["message"], message: "Encrypted text must be base64" });
    }
};

export const sendMessageSchema = {
    params: conversationParams,
    body: z
        .object({
            message: z.string().max(MAX_CIPHERTEXT_LENGTH, tooLong).default(""),
            mediaUrl: httpsUrl("Media").nullish(),
            mediaType: z.enum(["text", "image", "video", "audio", "file"]).default("text"),
            replyTo: objectId("Reply").nullish(),
            isCall: z.boolean().default(false),
            isForwarded: z.boolean().default(false),
            // Made by the browser, so a retried send is saved only once
            clientId: z.uuid("Client id must be a UUID").optional(),
            e2ee: e2eeFields.optional(),
            newKey: newChatKey.optional(),
        })
        .superRefine(checkText)
        .refine((data) => data.message.trim() || data.mediaUrl, {
            path: ["message"],
            error: "Message can't be empty",
        })
        // The file itself is encrypted in the browser before it's uploaded
        .refine((data) => !data.e2ee || !data.mediaUrl || data.e2ee.media, {
            path: ["mediaUrl"],
            error: "Attachments in this chat must be encrypted",
        }),
};

export const conversationIdSchema = { params: conversationParams };

// Off, 1 hour, 1 day, 7 days
export const DISAPPEAR_CHOICES = [0, 3600, 86400, 604800] as const;

export const disappearTimerSchema = {
    params: conversationParams,
    body: z.object({
        seconds: z
            .number({ error: "Seconds must be a number" })
            .refine((value) => (DISAPPEAR_CHOICES as readonly number[]).includes(value), {
                error: "Timer must be off, 1 hour, 1 day or 7 days",
            }),
    }),
};

export const reactionSchema = {
    params: messageParams,
    body: z.object({
        // Emoji with skin tones or joiners can be several characters long
        reaction: requiredText("Reaction", 32),
    }),
};

export const editMessageSchema = {
    params: messageParams,
    body: z
        .object({
            message: requiredText("Message", MAX_CIPHERTEXT_LENGTH),
            e2ee: e2eeFields.optional(),
            newKey: newChatKey.optional(),
        })
        .superRefine(checkText),
};

export const messageIdSchema = { params: messageParams };

export const magicReplySchema = {
    body: z.object({
        // Only the recent chat is needed, and short texts keep the prompt small
        messages: z
            .array(
                z.object({
                    sender: z.string().max(100).catch("Other user"),
                    text: z
                        .string()
                        .nullish()
                        .transform((text) => (text ?? "").slice(0, 500)),
                }),
                { error: "No messages to reply to" },
            )
            .min(1, "No messages to reply to")
            .transform((messages) => messages.slice(-10)),
        requestedTone: z.enum(["Auto", "Professional", "Casual", "Funny"]).default("Auto"),
    }),
};

// ---------- groups ----------

const groupParams = z.object({ groupId: objectId("Group id") });
const groupName = requiredText("Group name", MAX_NAME_LENGTH);

export const createGroupSchema = {
    body: z.object({
        name: groupName,
        participants: z
            .array(objectId("Participant"), { error: "Pick at least one person" })
            .min(1, "Pick at least one person")
            .max(100, "A group can have at most 100 people")
            .transform((ids) => [...new Set(ids)]),
    }),
};

export const groupIdSchema = { params: groupParams };

export const updateGroupSchema = {
    params: groupParams,
    body: z
        .object({
            groupName: groupName.optional(),
            groupIcon: httpsUrl("Group icon").optional(),
        })
        .refine((data) => data.groupName || data.groupIcon, {
            error: "Nothing to update",
        }),
};

export const groupNameSchema = {
    params: groupParams,
    body: z.object({ name: groupName }),
};

export const addParticipantSchema = {
    params: groupParams,
    body: z.object({ userIdToAdd: objectId("User id") }),
};

export const removeParticipantSchema = {
    params: groupParams,
    body: z.object({ userIdToRemove: objectId("User id") }),
};

export const makeAdminSchema = {
    params: groupParams,
    body: z.object({ userIdToMakeAdmin: objectId("User id") }),
};

export const dismissAdminSchema = {
    params: groupParams,
    body: z.object({ userIdToDismiss: objectId("User id") }),
};

// ---------- users ----------

export const usernameSchema = {
    params: z.object({ username: requiredText("Username", 100) }),
};

export const profilePicSchema = {
    body: z.object({ profilePic: httpsUrl("Profile picture") }),
};

export const privacySchema = {
    body: z.object({
        isPublic: z.boolean({ error: "Privacy setting must be true or false" }),
    }),
};

// ---------- push ----------

const pushEndpoint = httpsUrl("Push endpoint").max(1000, "Push endpoint is too long");

export const pushSubscribeSchema = {
    body: z.object({
        endpoint: pushEndpoint,
        keys: z.object(
            {
                p256dh: requiredText("Push key", 200),
                auth: requiredText("Push auth secret", 100),
            },
            { error: "Push keys are required" },
        ),
    }),
};

export const pushUnsubscribeSchema = {
    body: z.object({ endpoint: pushEndpoint }),
};
