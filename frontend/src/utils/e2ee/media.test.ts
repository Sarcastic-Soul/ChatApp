import { describe, expect, test } from "vitest";
import { decryptBytes, decryptText, encryptBytes, encryptText, newChatKey } from "./crypto";

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;
const text = (data: ArrayBuffer) => new TextDecoder().decode(data);

describe("attachment encryption", () => {
    test("a file comes back the same with its key", async () => {
        const sealed = await encryptBytes(bytes("not really a photo"));
        expect(text(sealed.data)).not.toContain("photo");
        expect(text(await decryptBytes(sealed.data, sealed.key, sealed.iv))).toBe("not really a photo");
    });

    test("every file gets its own key", async () => {
        const a = await encryptBytes(bytes("same"));
        const b = await encryptBytes(bytes("same"));
        expect(a.key).not.toBe(b.key);
    });

    test("a wrong key or a changed file fails instead of giving bad data", async () => {
        const sealed = await encryptBytes(bytes("voice note"));
        const other = await encryptBytes(bytes("other"));
        await expect(decryptBytes(sealed.data, other.key, sealed.iv)).rejects.toThrow();

        const changed = new Uint8Array(sealed.data.slice(0));
        changed[0] ^= 1;
        await expect(decryptBytes(changed.buffer, sealed.key, sealed.iv)).rejects.toThrow();
    });

    test("the key can't be read without the chat key", async () => {
        const chatKey = await newChatKey();
        const sealed = await encryptText(chatKey, JSON.stringify({ key: "abc", iv: "def", mime: "image/jpeg" }));
        expect(atob(sealed.ciphertext)).not.toContain("image/jpeg");
        expect(JSON.parse(await decryptText(chatKey, sealed))).toMatchObject({ key: "abc" });
        await expect(decryptText(await newChatKey(), sealed)).rejects.toThrow();
    });
});
