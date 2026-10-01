import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Message } from "../types";

const DB_NAME = "chat-db";

// One row per conversation, keyed by the conversation id
interface ChatDB extends DBSchema {
    messages: {
        key: string;
        value: { id: string; messages: Message[]; timestamp: number };
    };
}

let dbInstance: IDBPDatabase<ChatDB> | null = null;

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null;

const getDB = () => {
    if (!dbPromise) {
        dbPromise = openDB<ChatDB>(DB_NAME, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains("messages")) {
                    db.createObjectStore("messages", { keyPath: "id" });
                }
            },
        }).then((db) => {
            dbInstance = db;
            return db;
        });
    }
    return dbPromise;
};

/**
 * Retrieves all cached messages for a given conversation.
 */
export const getCachedMessages = async (conversationId: string) => {
    const db = await getDB();
    const entry = await db.get("messages", conversationId);
    return entry?.messages || [];
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
