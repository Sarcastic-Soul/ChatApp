import { z } from "zod";
import { httpsUrl, objectId, requiredText } from "./fields.js";

// Request schemas, grouped by route file. Each one lists the parts of the
// request it checks (params, query, body). Unknown fields are dropped.

const MAX_MESSAGE_LENGTH = 5000;
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

// ---------- messages ----------

const conversationParams = z.object({ id: objectId("Conversation id") });
const messageParams = z.object({ messageId: objectId("Message id") });

export const getMessagesSchema = {
    params: conversationParams,
    query: z.object({
        before: objectId("Cursor").optional(),
        limit: z.coerce
            .number({ error: "Limit must be a number" })
            .int()
            .min(1, "Limit must be between 1 and 100")
            .max(100, "Limit must be between 1 and 100")
            .default(50),
    }),
};

// The id is a conversation id, or a user id when starting a new 1-on-1 chat
export const searchMessagesSchema = {
    query: z.object({
        q: requiredText("Search text", 100),
        limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
};

export const sendMessageSchema = {
    params: conversationParams,
    body: z
        .object({
            message: z
                .string()
                .max(MAX_MESSAGE_LENGTH, `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer`)
                .default(""),
            mediaUrl: httpsUrl("Media").nullish(),
            mediaType: z.enum(["text", "image", "video", "audio", "file"]).default("text"),
            replyTo: objectId("Reply").nullish(),
            isCall: z.boolean().default(false),
            isForwarded: z.boolean().default(false),
        })
        .refine((data) => data.message.trim() || data.mediaUrl, {
            path: ["message"],
            error: "Message can't be empty",
        }),
};

export const conversationIdSchema = { params: conversationParams };

export const reactionSchema = {
    params: messageParams,
    body: z.object({
        // Emoji with skin tones or joiners can be several characters long
        reaction: requiredText("Reaction", 32),
    }),
};

export const editMessageSchema = {
    params: messageParams,
    body: z.object({ message: requiredText("Message", MAX_MESSAGE_LENGTH) }),
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
