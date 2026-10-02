import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from "idb";
import { createIdentity, restoreIdentity, type Identity, type KeyBackup } from "./crypto";
import type { ApiError } from "../../types";

// The logged-in user's key pair in this browser. The private key is saved
// in IndexedDB as a non-extractable CryptoKey, in its own database so that
// logging out can delete it along with the message cache.

export interface StoredIdentity extends Identity {
    userId: string;
    keyVersion: number;
}

interface KeysDB extends DBSchema {
    identity: { key: string; value: StoredIdentity };
}

const DB_NAME = "chat-keys";
let dbPromise: Promise<IDBPDatabase<KeysDB>> | null = null;
let current: StoredIdentity | null = null;

const db = () => {
    dbPromise ??= openDB<KeysDB>(DB_NAME, 1, {
        upgrade(database) {
            database.createObjectStore("identity");
        },
    });
    return dbPromise;
};

export const currentIdentity = () => current;

export const loadIdentity = async (userId: string) => {
    const stored = await (await db()).get("identity", "me");
    current = stored && stored.userId === userId ? stored : null;
    return current;
};

const saveIdentity = async (identity: StoredIdentity) => {
    await (await db()).put("identity", identity, "me");
    current = identity;
};

export const forgetIdentity = async () => {
    current = null;
    if (dbPromise) {
        (await dbPromise).close();
        dbPromise = null;
    }
    await deleteDB(DB_NAME);
};

// GET /api/keys/me
export interface MyKey {
    publicKey: string | null;
    keyVersion?: number;
    backup?: KeyBackup | null;
}

export const fetchMyKey = async (): Promise<MyKey> => {
    const res = await fetch("/api/keys/me");
    const data = (await res.json()) as MyKey & ApiError;
    if (!res.ok) throw new Error(data.error || "Couldn't load your encryption key");
    return data;
};

export class AlreadySetUpError extends Error {}

// Makes a key pair, saves its public half and passphrase backup on the
// server, and keeps the private key in this browser. `reset` replaces an
// existing key.
export const setUpEncryption = async (userId: string, passphrase: string, { reset = false, iterations }: { reset?: boolean; iterations?: number } = {}) => {
    const { identity, backup } = await createIdentity(passphrase, iterations);
    const res = await fetch("/api/keys/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey: identity.publicKey, backup, reset }),
    });
    const data = (await res.json()) as { keyVersion?: number } & ApiError;
    if (res.status === 409) throw new AlreadySetUpError(data.error);
    if (!res.ok || data.keyVersion == null) throw new Error(data.error || "Couldn't save your encryption key");
    await saveIdentity({ ...identity, userId, keyVersion: data.keyVersion });
};

// Restores the private key on a new browser from the server's backup
export const unlockEncryption = async (userId: string, myKey: MyKey, passphrase: string) => {
    if (!myKey.backup || !myKey.publicKey || myKey.keyVersion == null) {
        throw new Error("There's no key backup for this account.");
    }
    const identity = await restoreIdentity(myKey.backup, passphrase);
    if (identity.publicKey !== myKey.publicKey) {
        throw new Error("This backup doesn't match your account's key.");
    }
    await saveIdentity({ ...identity, userId, keyVersion: myKey.keyVersion });
};
