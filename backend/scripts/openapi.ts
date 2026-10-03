import { writeFileSync } from "node:fs";
import { z } from "zod";
import * as schemas from "../validation/schemas.ts";

// Writes frontend/public/openapi.json, the file behind the API reference page
// at /docs. Request shapes come from the same zod schemas the routes check
// input with, so the page can't drift from the validation. Run it after
// adding or changing a route: pnpm run openapi

type RequestSchemas = { params?: z.ZodType; query?: z.ZodType; body?: z.ZodType };

type Route = {
    method: "get" | "post" | "put" | "delete";
    path: string;
    tag: string;
    summary: string;
    description?: string;
    schema?: RequestSchemas;
    // No login cookie needed
    open?: boolean;
    // Counts toward the 50 requests a minute message limit
    limited?: boolean;
    // Success status, 200 unless set
    status?: number;
    // Served by Render directly, outside /api
    root?: boolean;
};

const routes: Route[] = [
    // ---------- auth ----------
    { method: "post", path: "/auth/signup", tag: "Auth", summary: "Create an account and log in", schema: schemas.signupSchema, open: true, status: 201 },
    { method: "post", path: "/auth/login", tag: "Auth", summary: "Log in", description: "Sets the `jwt` login cookie.", schema: schemas.loginSchema, open: true },
    { method: "post", path: "/auth/logout", tag: "Auth", summary: "Log out", open: true },
    { method: "get", path: "/auth/me", tag: "Auth", summary: "Current user" },
    {
        method: "get",
        path: "/auth/socket-token",
        tag: "Auth",
        summary: "Short-lived token for the socket connection",
        description: "The token lasts 5 minutes and is only valid for opening a socket.",
    },

    // ---------- users ----------
    { method: "get", path: "/users", tag: "Users", summary: "Public users other than you" },
    { method: "get", path: "/users/conversations", tag: "Users", summary: "Your chats and groups, newest first" },
    { method: "get", path: "/users/new", tag: "Users", summary: "Public users you don't have a chat with yet" },
    { method: "get", path: "/users/{username}", tag: "Users", summary: "A user's profile", schema: schemas.usernameSchema },
    { method: "put", path: "/users/update-pic", tag: "Users", summary: "Change your profile picture", schema: schemas.profilePicSchema },
    { method: "put", path: "/users/privacy", tag: "Users", summary: "Make your profile public or private", schema: schemas.privacySchema },

    // ---------- messages ----------
    {
        method: "get",
        path: "/messages/search",
        tag: "Messages",
        summary: "Search messages in your chats, newest first",
        description: "Finds messages the server can read. End-to-end encrypted messages are searched in the browser instead.",
        schema: schemas.searchMessagesSchema,
    },
    {
        method: "get",
        path: "/messages/{id}",
        tag: "Messages",
        summary: "Messages in a chat",
        description:
            "With `before` (or neither cursor), returns messages newest first, 50 at a time. With `after`, returns messages after that sequence number, oldest first; this is the catch-up after a reconnect.",
        schema: schemas.getMessagesSchema,
    },
    {
        method: "post",
        path: "/messages/send/{id}",
        tag: "Messages",
        summary: "Send a message",
        description:
            "`id` is a chat id, or a user id to start a chat. A repeat `clientId` returns the saved message instead of making a second one. Encrypted messages carry `e2ee`, plus `newKey` when they start a new chat key. Once every member of a chat has a key, plain text is refused with `409` and `code: \"keys_changed\"`.",
        schema: schemas.sendMessageSchema,
        limited: true,
    },
    { method: "put", path: "/messages/edit/{messageId}", tag: "Messages", summary: "Edit your message", schema: schemas.editMessageSchema, limited: true },
    { method: "delete", path: "/messages/delete/{messageId}", tag: "Messages", summary: "Delete your message for everyone", schema: schemas.messageIdSchema, limited: true },
    { method: "post", path: "/messages/react/{messageId}", tag: "Messages", summary: "Add, change or remove a reaction", schema: schemas.reactionSchema },
    { method: "post", path: "/messages/read/{id}", tag: "Messages", summary: "Mark a chat as read", schema: schemas.conversationIdSchema },
    {
        method: "post",
        path: "/messages/magic-reply",
        tag: "Messages",
        summary: "Draft a reply with AI",
        description: "Only the last 10 messages are used, 500 characters each at most.",
        schema: schemas.magicReplySchema,
        limited: true,
    },

    // ---------- keys ----------
    { method: "get", path: "/keys/me", tag: "Keys", summary: "Your public key, key version and passphrase backup" },
    {
        method: "put",
        path: "/keys/me",
        tag: "Keys",
        summary: "Save your public key and backup",
        description: "`reset: true` replaces an existing key.",
        schema: schemas.setMyKeySchema,
    },
    {
        method: "get",
        path: "/keys/chats/{id}",
        tag: "Keys",
        summary: "A chat's members, their public keys and your chat key copies",
        description:
            "Returns the members and their public keys, the newest chat key epoch, and your copies of each chat key. `id` can be a user id for a chat that doesn't exist yet.",
        schema: schemas.chatKeysSchema,
    },

    // ---------- groups ----------
    { method: "post", path: "/groups/create", tag: "Groups", summary: "Create a group", schema: schemas.createGroupSchema, status: 201 },
    { method: "get", path: "/groups/{groupId}", tag: "Groups", summary: "Group details", schema: schemas.groupIdSchema },
    { method: "put", path: "/groups/{groupId}/update", tag: "Groups", summary: "Change the group name or icon", description: "Admins only.", schema: schemas.updateGroupSchema },
    { method: "put", path: "/groups/{groupId}/name", tag: "Groups", summary: "Rename the group", description: "Admins only.", schema: schemas.groupNameSchema },
    { method: "put", path: "/groups/{groupId}/participants/add", tag: "Groups", summary: "Add a member", description: "Admins only.", schema: schemas.addParticipantSchema },
    {
        method: "put",
        path: "/groups/{groupId}/participants/remove",
        tag: "Groups",
        summary: "Remove a member, or leave the group",
        description: "Admins can remove anyone. Any member can remove themselves to leave.",
        schema: schemas.removeParticipantSchema,
    },
    { method: "put", path: "/groups/{groupId}/admins/add", tag: "Groups", summary: "Make a member an admin", description: "Admins only.", schema: schemas.makeAdminSchema },
    { method: "put", path: "/groups/{groupId}/admins/remove", tag: "Groups", summary: "Remove an admin", description: "Admins only. The last admin can't be removed.", schema: schemas.dismissAdminSchema },
    { method: "delete", path: "/groups/{groupId}/delete", tag: "Groups", summary: "Delete the group", description: "Admins only.", schema: schemas.groupIdSchema },

    // ---------- calls ----------
    {
        method: "get",
        path: "/calls/ice-servers",
        tag: "Calls",
        summary: "STUN and TURN servers for a call",
        description: "TURN credentials are short-lived. With no TURN provider set up, only STUN servers come back.",
    },

    // ---------- push ----------
    { method: "get", path: "/push/public-key", tag: "Push", summary: "VAPID public key", description: "Returns `404` when push isn't set up.", open: true },
    { method: "post", path: "/push/subscribe", tag: "Push", summary: "Save this browser's push subscription", schema: schemas.pushSubscribeSchema, status: 201 },
    { method: "post", path: "/push/unsubscribe", tag: "Push", summary: "Remove this browser's push subscription", schema: schemas.pushUnsubscribeSchema },

    // ---------- uploads ----------
    {
        method: "get",
        path: "/cloudinary/signature",
        tag: "Uploads",
        summary: "Signed upload for chat media",
        description: "The browser uses the signature to upload straight to Cloudinary.",
    },
    { method: "get", path: "/cloudinary/signature/profile-pic", tag: "Uploads", summary: "Signed upload for a profile picture" },
    { method: "get", path: "/cloudinary/signature/group-icon", tag: "Uploads", summary: "Signed upload for a group icon" },

    // ---------- health ----------
    {
        method: "get",
        path: "/healthz",
        tag: "Health",
        summary: "Health check",
        description: "Returns `{ \"status\": \"ok\" }`. This is what the keep-alive job pings.",
        open: true,
        root: true,
    },
];

type JsonSchema = {
    properties?: Record<string, object>;
    required?: string[];
    [key: string]: unknown;
};

// What the client sends, before defaults and transforms run
const toJsonSchema = (schema: z.ZodType): JsonSchema => {
    const { $schema, ...rest } = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as JsonSchema;
    return rest;
};

const toParameters = (schema: z.ZodType | undefined, where: "path" | "query") => {
    if (!schema) return [];
    const { properties = {}, required = [] } = toJsonSchema(schema);
    return Object.entries(properties).map(([name, property]) => ({
        name,
        in: where,
        required: where === "path" || required.includes(name),
        schema: property,
    }));
};

const errorResponse = (description: string, ref = "Error") => ({
    description,
    content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } },
});

const toOperation = (route: Route) => {
    const parameters = [...toParameters(route.schema?.params, "path"), ...toParameters(route.schema?.query, "query")];
    const responses: Record<string, object> = {
        [route.status ?? 200]: { description: "Success" },
    };
    if (route.schema) responses[400] = errorResponse("The input failed validation", "ValidationError");
    if (!route.open) responses[401] = errorResponse("Not logged in");
    if (route.limited) responses[429] = errorResponse("More than 50 requests in a minute");

    return {
        tags: [route.tag],
        summary: route.summary,
        ...(route.description && { description: route.description }),
        ...(route.open && { security: [] }),
        ...(parameters.length > 0 && { parameters }),
        ...(route.schema?.body && {
            requestBody: {
                required: true,
                content: { "application/json": { schema: toJsonSchema(route.schema.body) } },
            },
        }),
        responses,
    };
};

const paths: Record<string, Record<string, object>> = {};
for (const route of routes) {
    paths[route.path] ??= {};
    // Vercel only forwards /api, so this one is called on Render directly
    if (route.root) paths[route.path].servers = [{ url: "https://socket-chat-w578.onrender.com" }];
    paths[route.path][route.method] = toOperation(route);
}

const spec = {
    openapi: "3.1.0",
    info: {
        title: "ChatApp API",
        version: "1.0.0",
        description: [
            "REST API of [ChatApp](https://github.com/Sarcastic-Soul/ChatApp).",
            "",
            "- Every route except signup, login, logout and the push public key needs the `jwt` login cookie. Log in on this site first and the requests you send from this page carry it.",
            "- Errors come back as `{ \"error\": \"message\" }`. Validation errors also include an `issues` array.",
            "- Request shapes on this page are generated from the zod schemas the server checks input with.",
            "- Live updates (new messages, typing, calls) go over Socket.IO, which this page doesn't cover.",
        ].join("\n"),
        license: { name: "MIT", url: "https://github.com/Sarcastic-Soul/ChatApp/blob/main/LICENSE" },
    },
    servers: [{ url: "/api", description: "This site" }],
    tags: [
        { name: "Auth" },
        { name: "Users" },
        { name: "Messages" },
        { name: "Keys", description: "Public keys and chat keys for end-to-end encryption" },
        { name: "Groups" },
        { name: "Calls" },
        { name: "Push" },
        { name: "Uploads" },
        { name: "Health" },
    ],
    security: [{ cookieAuth: [] }],
    paths,
    components: {
        securitySchemes: {
            cookieAuth: { type: "apiKey", in: "cookie", name: "jwt", description: "Set by `POST /auth/login` and `POST /auth/signup`" },
        },
        schemas: {
            Error: {
                type: "object",
                properties: { error: { type: "string" } },
                required: ["error"],
            },
            ValidationError: {
                type: "object",
                properties: {
                    error: { type: "string", description: "The first problem found" },
                    issues: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: { path: { type: "string" }, message: { type: "string" } },
                            required: ["path", "message"],
                        },
                    },
                },
                required: ["error", "issues"],
            },
        },
    },
};

const file = new URL("../../frontend/public/openapi.json", import.meta.url);
writeFileSync(file, JSON.stringify(spec, null, 2) + "\n");
console.log(`Wrote ${routes.length} routes to frontend/public/openapi.json`);
