import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// Checking that a contact's key is really theirs. The server hands out
// public keys, so a dishonest server could hand out its own. Two things
// guard against that:
//  - a safety number both people can compare, made from both public keys
//  - this browser remembers the key it first saw for each contact and
//    warns when the server later shows a different one
// What is remembered here is not secret, so it survives logging out.

export interface KeyHolder {
    _id: string;
    publicKey: string;
}

// What this browser knows about one contact's key
export interface PeerTrust {
    _id: string;
    publicKey: string;
    // The key differs from the one remembered for this contact
    changed: boolean;
    // The user compared safety numbers for exactly this key
    verified: boolean;
}

interface TrustDB extends DBSchema {
    // Keyed by "<my user id>:<contact's user id>"
    contacts: { key: string; value: { publicKey: string; verified: boolean } };
}

let dbPromise: Promise<IDBPDatabase<TrustDB>> | null = null;

const db = () => {
    dbPromise ??= openDB<TrustDB>("chat-trust", 1, {
        upgrade(database) {
            database.createObjectStore("contacts");
        },
    });
    return dbPromise;
};

const GROUPS = 12;

// A 60-digit number that is the same on both people's screens only when
// both see the same pair of keys. The two are sorted, so the order of
// "me" and "them" doesn't matter.
export const safetyNumber = async (a: KeyHolder, b: KeyHolder) => {
    const text = [a, b]
        .map((holder) => `${holder._id}:${holder.publicKey}`)
        .sort()
        .join("|");
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text)));
    return Array.from({ length: GROUPS }, (_unused, group) => {
        // Five bytes make one five-digit group
        const value = hash.slice(group * 5, group * 5 + 5).reduce((sum, byte) => sum * 256 + byte, 0);
        return String(value % 100000).padStart(5, "0");
    });
};

// Compares each contact's key with the one remembered. A contact seen for
// the first time is remembered as they are.
export const checkPeers = async (myId: string, peers: KeyHolder[]): Promise<PeerTrust[]> => {
    const store = await db();
    return Promise.all(
        peers.map(async (peer) => {
            const key = `${myId}:${peer._id}`;
            const known = await store.get("contacts", key);
            if (!known) {
                await store.put("contacts", { publicKey: peer.publicKey, verified: false }, key);
                return { ...peer, changed: false, verified: false };
            }
            const changed = known.publicKey !== peer.publicKey;
            return { ...peer, changed, verified: !changed && known.verified };
        }),
    );
};

// Remembers a contact's current key, as verified or not. Accepting a
// changed key without comparing numbers clears the old verification.
export const rememberPeer = async (myId: string, peer: KeyHolder, verified: boolean) => {
    await (await db()).put("contacts", { publicKey: peer.publicKey, verified }, `${myId}:${peer._id}`);
};
