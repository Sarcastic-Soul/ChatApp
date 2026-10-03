// Web Crypto building blocks for end-to-end encryption. Nothing here talks
// to the server; chats.ts and identity.ts decide what to encrypt and when.
//
// - Each user has a P-256 ECDH key pair. The public key goes to the server.
// - Each chat has a random AES-GCM key. It's encrypted once per member: a
//   one-time ECDH key pair and the member's public key give a shared
//   secret, HKDF turns it into an AES key, and that wraps the chat key.
// - The private key is backed up encrypted with a key made from a
//   passphrase (PBKDF2), so a new browser can restore it.

const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;
const WRAP_INFO = new TextEncoder().encode("ChatApp chat key v1");

// OWASP's 2023 advice for PBKDF2-SHA256
export const PBKDF2_ITERATIONS = 600_000;

export interface KeyBackup {
    salt: string;
    iv: string;
    data: string;
    iterations: number;
}

// One member's copy of a chat key
export interface SealedKey {
    ephemeralKey: string;
    iv: string;
    wrappedKey: string;
}

export interface SealedText {
    ciphertext: string;
    iv: string;
}

export const toBase64 = (data: ArrayBuffer | Uint8Array) => {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
};

export const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

const importPublicKey = (publicKey: string) =>
    crypto.subtle.importKey("raw", fromBase64(publicKey), ECDH, false, []);

// Kept in IndexedDB as a key the page can use but never read back out
const importPrivateKey = (pkcs8: ArrayBuffer) =>
    crypto.subtle.importKey("pkcs8", pkcs8, ECDH, false, ["deriveBits"]);

// The raw public key (0x04, x, y) that belongs to a private key
const publicKeyOf = async (pkcs8: ArrayBuffer) => {
    const key = await crypto.subtle.importKey("pkcs8", pkcs8, ECDH, true, ["deriveBits"]);
    const { x, y } = await crypto.subtle.exportKey("jwk", key);
    const decode = (part = "") => fromBase64(part.replace(/-/g, "+").replace(/_/g, "/"));
    return toBase64(new Uint8Array([4, ...decode(x), ...decode(y)]));
};

export interface Identity {
    privateKey: CryptoKey;
    publicKey: string;
}

// A new key pair, plus its backup under the passphrase
export const createIdentity = async (passphrase: string, iterations = PBKDF2_ITERATIONS) => {
    const pair = await crypto.subtle.generateKey(ECDH, true, ["deriveBits"]);
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", pair.privateKey);
    const publicKey = toBase64(await crypto.subtle.exportKey("raw", pair.publicKey));
    const backup = await backUp(pkcs8, passphrase, iterations);
    const identity: Identity = { privateKey: await importPrivateKey(pkcs8), publicKey };
    return { identity, backup };
};

const passphraseKey = async (passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number) => {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
        "deriveKey",
    ]);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    );
};

const backUp = async (pkcs8: ArrayBuffer, passphrase: string, iterations: number): Promise<KeyBackup> => {
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = await passphraseKey(passphrase, salt, iterations);
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pkcs8);
    return { salt: toBase64(salt), iv: toBase64(iv), data: toBase64(data), iterations };
};

export class WrongPassphraseError extends Error {
    constructor() {
        super("That passphrase didn't work.");
    }
}

// Opens a backup. AES-GCM fails on a wrong passphrase, so a typo can't
// produce a wrong key.
export const restoreIdentity = async (backup: KeyBackup, passphrase: string): Promise<Identity> => {
    const key = await passphraseKey(passphrase, fromBase64(backup.salt), backup.iterations);
    let pkcs8: ArrayBuffer;
    try {
        pkcs8 = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(backup.iv) }, key, fromBase64(backup.data));
    } catch {
        throw new WrongPassphraseError();
    }
    return { privateKey: await importPrivateKey(pkcs8), publicKey: await publicKeyOf(pkcs8) };
};

const wrappingKey = async (privateKey: CryptoKey, publicKey: CryptoKey) => {
    const secret = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
    const base = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: WRAP_INFO },
        base,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    );
};

export const newChatKey = () => crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

// A copy of the chat key only the owner of `publicKey` can open
export const sealChatKey = async (chatKey: CryptoKey, publicKey: string): Promise<SealedKey> => {
    const oneTime = await crypto.subtle.generateKey(ECDH, true, ["deriveBits"]);
    const key = await wrappingKey(oneTime.privateKey, await importPublicKey(publicKey));
    const iv = randomBytes(12);
    const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await crypto.subtle.exportKey("raw", chatKey));
    return {
        ephemeralKey: toBase64(await crypto.subtle.exportKey("raw", oneTime.publicKey)),
        iv: toBase64(iv),
        wrappedKey: toBase64(wrapped),
    };
};

export const openChatKey = async (sealed: SealedKey, privateKey: CryptoKey) => {
    const key = await wrappingKey(privateKey, await importPublicKey(sealed.ephemeralKey));
    const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(sealed.iv) }, key, fromBase64(sealed.wrappedKey));
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
};

export const encryptText = async (chatKey: CryptoKey, text: string): Promise<SealedText> => {
    const iv = randomBytes(12);
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chatKey, new TextEncoder().encode(text));
    return { ciphertext: toBase64(data), iv: toBase64(iv) };
};

export const decryptText = async (chatKey: CryptoKey, { ciphertext, iv }: SealedText) => {
    const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, chatKey, fromBase64(ciphertext));
    return new TextDecoder().decode(data);
};

// Attachments get a key of their own, so forwarding one to another chat
// only means sharing that key again, not uploading the file a second time
export const encryptBytes = async (data: ArrayBuffer) => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
    const iv = randomBytes(12);
    return {
        data: await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data),
        key: toBase64(await crypto.subtle.exportKey("raw", key)),
        iv: toBase64(iv),
    };
};

export const decryptBytes = async (data: ArrayBuffer, key: string, iv: string) => {
    const fileKey = await crypto.subtle.importKey("raw", fromBase64(key), "AES-GCM", false, ["decrypt"]);
    return crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, fileKey, data);
};
