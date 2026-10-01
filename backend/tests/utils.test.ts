import { describe, expect, test, vi } from "vitest";
import { decryptText, encryptText } from "../utils/encryption.ts";
import { cleanProfanity } from "../utils/profanityFilter.ts";

describe("encryption", () => {
    test("round-trips text, including emoji", () => {
        const text = "meet at 6 🙂 — café";
        expect(decryptText(encryptText(text))).toBe(text);
    });

    test("uses a new IV every time", () => {
        const a = encryptText("same");
        const b = encryptText("same");
        expect(a).not.toBe(b);
        expect(a.split(":")[0]).toHaveLength(32);
    });

    test("leaves empty values alone", () => {
        expect(encryptText("")).toBe("");
        expect(decryptText(null)).toBeNull();
    });

    test("bad ciphertext gives a placeholder instead of throwing", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        expect(decryptText("not encrypted")).toBe("[Message could not be decrypted]");
        expect(decryptText("abcd:1234")).toBe("[Message could not be decrypted]");
        vi.restoreAllMocks();
    });

    test("refuses to load without ENCRYPTION_KEY", async () => {
        vi.resetModules();
        vi.stubEnv("ENCRYPTION_KEY", "");
        await expect(import("../utils/encryption.ts")).rejects.toThrow("ENCRYPTION_KEY is not set.");
        vi.unstubAllEnvs();
    });
});

describe("profanity filter", () => {
    test("masks bad words and keeps the rest", () => {
        expect(cleanProfanity("well shit happens")).toBe("well **** happens");
        expect(cleanProfanity("hello there")).toBe("hello there");
    });

    test("passes through non-strings", () => {
        expect(cleanProfanity(undefined)).toBeUndefined();
        expect(cleanProfanity("")).toBe("");
    });
});
