import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
    WrongPassphraseError,
    createIdentity,
    decryptText,
    encryptText,
    newChatKey,
    openChatKey,
    restoreIdentity,
    sealChatKey,
    type Identity,
} from "./crypto";
import { currentIdentity, forgetIdentity, loadIdentity, setUpEncryption, unlockEncryption } from "./identity";
import { forgetChatKeys, openMessage, sealForChat, sendSealed, type NewChatKey } from "./chats";
import type { Message } from "../../types";

// Low PBKDF2 work so the tests stay fast; the real default is 600,000
const ITERATIONS = 1000;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    forgetChatKeys();
});

afterEach(async () => {
    vi.unstubAllGlobals();
    await forgetIdentity();
});

describe("crypto", () => {
    test("a backup opens with the right passphrase and gives the same public key", async () => {
        const { identity, backup } = await createIdentity("correct horse battery", ITERATIONS);
        const restored = await restoreIdentity(backup, "correct horse battery");
        expect(restored.publicKey).toBe(identity.publicKey);
        expect(restored.privateKey.extractable).toBe(false);
    });

    test("a wrong passphrase is refused", async () => {
        const { backup } = await createIdentity("correct horse battery", ITERATIONS);
        await expect(restoreIdentity(backup, "wrong horse battery")).rejects.toBeInstanceOf(WrongPassphraseError);
    });

    test("a sealed chat key opens only for its owner", async () => {
        const bob = (await createIdentity("bob passphrase", ITERATIONS)).identity;
        const eve = (await createIdentity("eve passphrase", ITERATIONS)).identity;
        const key = await newChatKey();
        const sealed = await sealChatKey(key, bob.publicKey);

        const text = await encryptText(key, "meet at noon");
        expect(await decryptText(await openChatKey(sealed, bob.privateKey), text)).toBe("meet at noon");
        await expect(openChatKey(sealed, eve.privateKey)).rejects.toThrow();
    });
});

describe("identity", () => {
    test("setting up saves the key in IndexedDB and the backup on the server", async () => {
        fetchMock.mockResolvedValueOnce(json(200, { publicKey: "ignored", keyVersion: 1 }));
        await setUpEncryption("alice", "alice passphrase", { iterations: ITERATIONS });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("/api/keys/me");
        const body = JSON.parse(init?.body as string);
        expect(body.backup.iterations).toBe(ITERATIONS);
        expect(JSON.stringify(body)).not.toContain("alice passphrase");

        const stored = await loadIdentity("alice");
        expect(stored?.publicKey).toBe(body.publicKey);
        expect(stored?.keyVersion).toBe(1);
        expect(stored?.privateKey).toBeInstanceOf(CryptoKey);
        // Someone else logging in on this browser doesn't get it
        expect(await loadIdentity("bob")).toBeNull();
    });

    test("unlocking checks the backup against the account's public key", async () => {
        const mine = await createIdentity("alice passphrase", ITERATIONS);
        const other = await createIdentity("other passphrase", ITERATIONS);

        await expect(
            unlockEncryption("alice", { publicKey: other.identity.publicKey, keyVersion: 1, backup: mine.backup }, "alice passphrase"),
        ).rejects.toThrow("doesn't match");

        await unlockEncryption("alice", { publicKey: mine.identity.publicKey, keyVersion: 2, backup: mine.backup }, "alice passphrase");
        expect(currentIdentity()?.keyVersion).toBe(2);
    });
});

describe("chats", () => {
    let alice: Identity;
    let bob: Identity;

    const members = () => [
        { _id: "alice", publicKey: alice.publicKey, keyVersion: 1 },
        { _id: "bob", publicKey: bob.publicKey, keyVersion: 1 },
    ];

    beforeEach(async () => {
        fetchMock.mockResolvedValueOnce(json(200, { keyVersion: 1 }));
        await setUpEncryption("alice", "alice passphrase", { iterations: ITERATIONS });
        alice = currentIdentity()!;
        bob = (await createIdentity("bob passphrase", ITERATIONS)).identity;
        fetchMock.mockReset();
    });

    test("text stays plain until everyone in the chat has a key", async () => {
        fetchMock.mockResolvedValueOnce(
            json(200, { conversationId: null, ready: false, epoch: null, current: false, members: [], keys: [] }),
        );
        expect(await sealForChat("bob", "hello")).toEqual({ message: "hello" });
    });

    test("the first sealed message brings a chat key for every member", async () => {
        fetchMock.mockResolvedValueOnce(
            json(200, { conversationId: "chat1", ready: true, epoch: null, current: false, members: members(), keys: [] }),
        );
        const fields = await sealForChat("bob", "oh shit, hello");

        expect(fields.message).not.toContain("hello");
        expect(fields.e2ee?.epoch).toBe(1);
        const newKey = fields.newKey as NewChatKey;
        expect(newKey.envelopes.map((e) => e.userId)).toEqual(["alice", "bob"]);

        // Bob opens his copy and reads the text, filtered here since the server can't
        const bobsCopy = newKey.envelopes.find((e) => e.userId === "bob")!;
        const key = await openChatKey(bobsCopy, bob.privateKey);
        expect(await decryptText(key, { ciphertext: fields.message, iv: fields.e2ee!.iv })).toBe("oh ****, hello");

        // Alice reads her own message back with her copy
        const alicesCopy = newKey.envelopes.find((e) => e.userId === "alice")!;
        fetchMock.mockResolvedValueOnce(
            json(200, {
                conversationId: "chat1",
                ready: true,
                epoch: 1,
                current: true,
                members: members(),
                keys: [{ ...alicesCopy, epoch: 1 }],
            }),
        );
        const opened = await openMessage({ _id: "m1", receiverId: "chat1", message: fields.message, e2ee: fields.e2ee } as Message);
        expect(opened).toMatchObject({ message: "oh ****, hello", endToEnd: true });
        expect(opened.e2ee).toBeUndefined();
    });

    test("a message sealed with a key this browser lacks shows as undecryptable", async () => {
        fetchMock.mockResolvedValue(
            json(200, { conversationId: "chat1", ready: true, epoch: 3, current: true, members: members(), keys: [] }),
        );
        const opened = await openMessage({
            _id: "m1",
            receiverId: "chat1",
            message: "AAAA",
            e2ee: { epoch: 3, iv: "AAAAAAAAAAAAAAAA" },
        } as Message);
        expect(opened).toMatchObject({ message: "", undecryptable: true });
    });

    test("a send refused because the keys changed is sealed again and retried once", async () => {
        const info = { conversationId: "chat1", ready: true, epoch: null, current: false, members: members(), keys: [] };
        fetchMock.mockImplementation(async () => json(200, info));
        const send = vi
            .fn<(fields: { message: string }) => Promise<Response>>()
            .mockResolvedValueOnce(json(409, { error: "Keys changed", code: "keys_changed" }))
            .mockResolvedValueOnce(json(201, { ok: true }));

        const res = await sendSealed("bob", "hello", send);
        expect(res.status).toBe(201);
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls[1][0].message).not.toBe("hello");
    });
});
