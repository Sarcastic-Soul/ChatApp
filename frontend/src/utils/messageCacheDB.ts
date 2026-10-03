import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from "idb";
import { hasExpired } from "./expiry";
import type { Conversation, Message } from "../types";

const DB_NAME = "chat-db";

// A message waiting to be sent. targetId is the chat id, or the other
// person's user id for the first message of a new chat.
export interface OutboxEntry {
    clientId: string;
    targetId: string;
    body: Record<string, unknown>;
    // The copy shown in the chat until the server saves it
    message: Message;
    createdAt: number;
}

interface ChatDB extends DBSchema {
    // One row per conversation, keyed by the conversation id
    messages: {
        key: string;
        value: { id: string; messages: Message[]; timestamp: number };
    };
    outbox: {
        key: string;
        value: OutboxEntry;
    };
    // A single row: the chat list as it was last loaded
    chats: {
        key: string;
        value: { id: string; conversations: Conversation[] };
    };
}

let dbInstance: IDBPDatabase<ChatDB> | null = null;

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null;

const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<ChatDB>(DB_NAME, 3, {
            upgrade(db) {
                if (!db.objectStoreNames.contains("messages")) {
                    db.createObjectStore("messages", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("outbox")) {
                    db.createObjectStore("outbox", { keyPath: "clientId" });
                }
                if (!db.objectStoreNames.contains("chats")) {
                    db.createObjectStore("chats", { keyPath: "id" });
                }
            },
        }).then((db) => {
            dbInstance = db;
            return db;
        });
    }
    return dbPromise;
};

// The chat list, kept so the app opens with it before the network
// answers, and when there is no network at all
export const getCachedChats = async () => {
    const db = await getDB();
    return (await db.get("chats", "list"))?.conversations ?? [];
};

export const setCachedChats = async (conversations: Conversation[]) => {
    const db = await getDB();
    await db.put("chats", { id: "list", conversations });
};

/**
 * Retrieves all cached messages for a given conversation.
 */
export const getCachedMessages = async (conversationId: string) => {
    const db = await getDB();
    const entry = await db.get("messages", conversationId);
    return (entry?.messages || []).filter((message) => !hasExpired(message));
};

/**
 * Overwrites the cache for a conversation. Use this for the initial fetch.
 */
export const setCachedMessages = async (conversationId: string, messages: Message[]) => {
    const db = await getDB();
    await db.put("messages", {
        id: conversationId,
        messages,
        timestamp: new Date().getTime(),
    });
};

/**
 * Prepends a chunk of older messages to the cache within a transaction.
 */
export const addOlderMessages = async (conversationId: string, olderMessages: Message[]) => {
    const db = await getDB();
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const entry = await store.get(conversationId);

    const existingMessageIds = new Set(entry?.messages.map((msg) => msg._id));
    const uniqueOlderMessages = olderMessages.filter(
        (oldMsg) => !existingMessageIds.has(oldMsg._id),
    );

    const combinedMessages = [
        ...uniqueOlderMessages,
        ...(entry?.messages || []),
    ];

    await store.put({
        id: conversationId,
        messages: combinedMessages,
        timestamp: new Date().getTime(),
    });

    await tx.done;
};

/**
 * Appends a single new message to the cache within a transaction.
 */
export const addMessageToCache = async (conversationId: string, newMessage: Message) => {
    const db = await getDB();
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const entry = await store.get(conversationId);

    const messageExists = entry?.messages.some(
        (msg) => msg._id === newMessage._id,
    );
    if (messageExists) {
        await tx.done;
        return;
    }

    const combinedMessages = [...(entry?.messages || []), newMessage];

    await store.put({
        id: conversationId,
        messages: combinedMessages,
        timestamp: new Date().getTime(),
    });

    await tx.done;
};

/**
 * Updates a specific message in the cache (for reactions, edits, etc.)
 */
export const updateMessageInCache = async (conversationId: string, updatedMessage: Message) => {
    const db = await getDB();
    const tx = db.transaction("messages", "readwrite");
    const store = tx.objectStore("messages");
    const entry = await store.get(conversationId);

    if (!entry || !entry.messages) {
        await tx.done;
        return;
    }

    const updatedMessages = entry.messages.map((msg) =>
        msg._id === updatedMessage._id ? updatedMessage : msg,
    );

    await store.put({
        id: conversationId,
        messages: updatedMessages,
        timestamp: new Date().getTime(),
    });

    await tx.done;
};

/**
 * Gets a specific message from cache
 */
export const getCachedMessage = async (conversationId: string, messageId: string) => {
    const messages = await getCachedMessages(conversationId);
    return messages.find((msg) => msg._id === messageId);
};

/**
 * Outbox: messages saved here before sending, removed once the server has them.
 */
// End-to-end encrypted messages can't be searched on the server, so they're
// searched in this browser's cache. Every word of the query has to appear.
export const searchCachedMessages = async (query: string, limit = 20) => {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
    if (terms.length === 0) return [];
    const db = await getDB();
    const entries = await db.getAll("messages");
    return entries
        .flatMap((entry) => entry.messages)
        .filter((m) => m.endToEnd && !m.isDeleted && terms.every((t) => m.message.toLowerCase().includes(t)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
};

export const addToOutbox = async (entry: OutboxEntry) => {
    const db = await getDB();
    await db.put("outbox", entry);
};

export const removeFromOutbox = async (clientId: string) => {
    const db = await getDB();
    await db.delete("outbox", clientId);
};

// Oldest first, so messages go out in the order they were written
export const getOutbox = async () => {
    const db = await getDB();
    const entries = await db.getAll("outbox");
    return entries.sort((a, b) => a.createdAt - b.createdAt);
};

export const clearAllMessages = async () => {
    try {
        // Close existing database connection if it exists
        if (dbInstance) {
            dbInstance.close();
            dbInstance = null;
        }
        dbPromise = null;

        // Wait a bit for any pending operations to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Delete the database
        await deleteDB(DB_NAME);
    } catch (error) {
        console.error("Failed to clear IndexedDB:", error);
        throw error;
    }
};
