import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import webPush from "web-push";
import Message from "../models/message.model.ts";
import { createUser } from "./helpers.ts";

vi.mock("web-push", () => ({
    default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));

// The server never checks the cryptography, only the shape and which
// keys are current, so made-up base64 values stand in for real keys
const b64 = (seed: string, length = 88) => Buffer.from(seed.repeat(length)).toString("base64").slice(0, length);
const backup = { salt: b64("salt", 24), iv: b64("iv", 16), data: b64("data", 200), iterations: 600_000 };

const setUpKey = (person, { reset = false, seed = person.user.username } = {}) =>
    person.agent.put("/api/keys/me").send({ publicKey: b64(seed), backup, reset });

const chatKeys = (person, id) => person.agent.get(`/api/keys/chats/${id}`);

// What a browser sends after making a new chat key: one copy per member
const newKeyFor = (info, epoch = (info.epoch ?? 0) + 1) => ({
    epoch,
    envelopes: info.members.map((m) => ({
        userId: m._id,
        keyVersion: m.keyVersion,
        ephemeralKey: b64(`eph${m._id}`),
        iv: b64("iv", 16),
        wrappedKey: b64(`wrapped${m._id}`, 64),
    })),
});

const ciphertext = b64("ciphertext", 64);
const sealed = (epoch, extra = {}) => ({ message: ciphertext, e2ee: { epoch, iv: b64("iv", 16) }, ...extra });

const send = (sender, id, body) => sender.agent.post(`/api/messages/send/${id}`).send(body);

afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
});

describe("a user's own key", () => {
    let alice;
    beforeAll(async () => {
        alice = await createUser();
    });

    test("starts empty", async () => {
        const res = await alice.agent.get("/api/keys/me");
        expect(res.status).toBe(200);
        expect(res.body.publicKey).toBeNull();
    });

    test("is saved with its passphrase backup, at version 1", async () => {
        const res = await setUpKey(alice);
        expect(res.status).toBe(200);
        expect(res.body.keyVersion).toBe(1);

        const mine = await alice.agent.get("/api/keys/me");
        expect(mine.body).toMatchObject({ publicKey: b64(alice.user.username), keyVersion: 1, backup });
    });

    test("can't be replaced by accident", async () => {
        const res = await setUpKey(alice, { seed: "other" });
        expect(res.status).toBe(409);
    });

    test("a reset makes a new version", async () => {
        const res = await setUpKey(alice, { reset: true, seed: "fresh" });
        expect(res.status).toBe(200);
        expect(res.body.keyVersion).toBe(2);
    });

    test("bad keys are refused", async () => {
        const res = await alice.agent.put("/api/keys/me").send({ publicKey: "not base64!", backup });
        expect(res.status).toBe(400);
        const noBackup = await alice.agent.put("/api/keys/me").send({ publicKey: b64("x") });
        expect(noBackup.status).toBe(400);
    });

    test("the backup is never shown to other people", async () => {
        const bob = await createUser();
        await setUpKey(bob);
        const res = await chatKeys(bob, alice.user._id);
        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body)).not.toContain(backup.data);
    });
});

describe("one-on-one chats", () => {
    let alice, bob, chatId;

    beforeAll(async () => {
        [alice, bob] = await Promise.all([createUser(), createUser()]);
    });

    test("stay on server encryption until both people have a key", async () => {
        await setUpKey(alice);
        const info = await chatKeys(alice, bob.user._id);
        expect(info.body).toMatchObject({ conversationId: null, ready: false, epoch: null, current: false });

        const res = await send(alice, bob.user._id, { message: "plain for now" });
        expect(res.status).toBe(201);
        chatId = res.body.newConversation._id;
        expect(res.body.newMessage.e2ee).toBeUndefined();

        // Bob has no key yet, so there's nothing to encrypt for him
        const early = await send(alice, chatId, sealed(1));
        expect(early.status).toBe(409);
    });

    test("plain text is refused once both have keys", async () => {
        await setUpKey(bob);
        const info = await chatKeys(alice, chatId);
        expect(info.body).toMatchObject({ ready: true, epoch: null, current: false });
        expect(info.body.members).toHaveLength(2);

        const res = await send(alice, chatId, { message: "hello" });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe("keys_changed");
    });

    test("call logs can still be plain", async () => {
        const res = await send(alice, chatId, { message: "Missed voice call", isCall: true });
        expect(res.status).toBe(201);
    });

    test("the first encrypted message brings the chat key", async () => {
        const info = await chatKeys(alice, chatId);
        const res = await send(alice, chatId, sealed(1, { newKey: newKeyFor(info.body) }));
        expect(res.status).toBe(201);
        expect(res.body.newMessage).toMatchObject({ message: ciphertext, e2ee: { epoch: 1 } });

        // Stored exactly as sent, with nothing for search
        const stored = await Message.findById(res.body.newMessage._id).select("+searchTokens").lean();
        expect(stored.message).toBe(ciphertext);
        expect(stored.searchTokens).toBeUndefined();
    });

    test("each person sees only their own copy of the chat key", async () => {
        const [forAlice, forBob] = await Promise.all([chatKeys(alice, chatId), chatKeys(bob, chatId)]);
        expect(forAlice.body).toMatchObject({ epoch: 1, current: true });
        expect(forAlice.body.keys).toHaveLength(1);
        expect(forAlice.body.keys[0].wrappedKey).toBe(b64(`wrapped${alice.user._id}`, 64));
        expect(forBob.body.keys[0].wrappedKey).toBe(b64(`wrapped${bob.user._id}`, 64));
    });

    test("later messages use the current key", async () => {
        const res = await send(bob, chatId, sealed(1));
        expect(res.status).toBe(201);

        const stale = await send(bob, chatId, sealed(2));
        expect(stale.status).toBe(409);
    });

    test("ciphertext comes back untouched in the history, quotes included", async () => {
        const first = await send(alice, chatId, sealed(1));
        const reply = await send(bob, chatId, sealed(1, { replyTo: first.body.newMessage._id }));
        expect(reply.body.newMessage.replyTo).toMatchObject({ message: ciphertext, e2ee: { epoch: 1 } });

        const history = await alice.agent.get(`/api/messages/${chatId}`);
        const encrypted = history.body.filter((m) => m.e2ee);
        expect(encrypted.length).toBeGreaterThanOrEqual(3);
        for (const m of encrypted) expect(m.message).toBe(ciphertext);
        // Older server-encrypted messages are still decrypted as before
        expect(history.body.some((m) => m.message === "plain for now")).toBe(true);
    });

    test("profanity filtering is left to the browser", async () => {
        const text = Buffer.from("this is shit").toString("base64");
        const res = await send(alice, chatId, { message: text, e2ee: { epoch: 1, iv: b64("iv", 16) } });
        expect(res.body.newMessage.message).toBe(text);
    });

    test("ciphertext must be base64", async () => {
        const res = await send(alice, chatId, { message: "plain words", e2ee: { epoch: 1, iv: b64("iv", 16) } });
        expect(res.status).toBe(400);
    });

    test("a key reset means the next sender makes a new chat key", async () => {
        await setUpKey(bob, { reset: true, seed: "bob-again" });
        const info = await chatKeys(alice, chatId);
        expect(info.body).toMatchObject({ epoch: 1, current: false });

        expect((await send(alice, chatId, sealed(1))).status).toBe(409);
        const res = await send(alice, chatId, sealed(2, { newKey: newKeyFor(info.body) }));
        expect(res.status).toBe(201);
        expect((await chatKeys(bob, chatId)).body).toMatchObject({ epoch: 2, current: true });
    });

    test("a chat key has to cover every member", async () => {
        const info = (await chatKeys(alice, chatId)).body;
        const partial = newKeyFor(info);
        partial.envelopes = partial.envelopes.slice(0, 1);
        const res = await send(alice, chatId, sealed(3, { newKey: partial }));
        expect(res.status).toBe(409);

        const wrongEpoch = await send(alice, chatId, sealed(5, { newKey: newKeyFor(info, 5) }));
        expect(wrongEpoch.status).toBe(409);
    });

    test("two browsers making the next key at once: only one wins", async () => {
        const info = (await chatKeys(alice, chatId)).body;
        const [a, b] = await Promise.all([
            send(alice, chatId, sealed(3, { newKey: newKeyFor(info) })),
            send(bob, chatId, sealed(3, { newKey: newKeyFor(info) })),
        ]);
        expect([a.status, b.status].sort()).toEqual([201, 409]);
        expect((await chatKeys(alice, chatId)).body.epoch).toBe(3);
    });

    test("edits are encrypted too", async () => {
        const sent = await send(alice, chatId, sealed(3));
        const id = sent.body.newMessage._id;

        const plain = await alice.agent.put(`/api/messages/edit/${id}`).send({ message: "plain edit" });
        expect(plain.status).toBe(409);

        const edited = b64("edited", 64);
        const res = await alice.agent
            .put(`/api/messages/edit/${id}`)
            .send({ message: edited, e2ee: { epoch: 3, iv: b64("iv2", 16) } });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ message: edited, isEdited: true, e2ee: { epoch: 3 } });
    });

    test("attachments must be encrypted, and keep their key through an edit", async () => {
        const mediaUrl = "https://res.cloudinary.com/demo/raw/upload/v1/photo.bin";
        const plain = await send(alice, chatId, sealed(3, { mediaUrl, mediaType: "image" }));
        expect(plain.status).toBe(400);
        expect(plain.body.error).toBe("Attachments in this chat must be encrypted");

        const media = { epoch: 3, iv: b64("media-iv", 16), data: b64("media-key", 120) };
        const sent = await send(alice, chatId, {
            message: ciphertext,
            e2ee: { epoch: 3, iv: b64("iv", 16), media },
            mediaUrl,
            mediaType: "image",
        });
        expect(sent.status).toBe(201);
        expect(sent.body.newMessage).toMatchObject({ mediaUrl, e2ee: { epoch: 3, media } });

        const edited = await alice.agent
            .put(`/api/messages/edit/${sent.body.newMessage._id}`)
            .send({ message: b64("caption", 64), e2ee: { epoch: 3, iv: b64("iv3", 16) } });
        expect(edited.body.e2ee).toMatchObject({ iv: b64("iv3", 16), media });

        const deleted = await alice.agent.delete(`/api/messages/delete/${sent.body.newMessage._id}`);
        expect(deleted.body).toMatchObject({ mediaUrl: null, mediaType: "text" });
        expect(deleted.body.e2ee).toBeUndefined();
    });

    test("deleting drops the ciphertext", async () => {
        const sent = await send(alice, chatId, sealed(3));
        const res = await alice.agent.delete(`/api/messages/delete/${sent.body.newMessage._id}`);
        expect(res.body.message).toBe("This message was deleted");
        expect(res.body.e2ee).toBeUndefined();
    });

    test("push notifications don't show encrypted text", async () => {
        vi.stubEnv("VAPID_PUBLIC_KEY", "test-public-key");
        vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
        await bob.agent.post("/api/push/subscribe").send({
            endpoint: "https://push.example.com/send/e2ee",
            keys: { p256dh: "p256dh-key", auth: "auth" },
        });

        await send(alice, chatId, sealed(3));
        await vi.waitFor(() => expect(webPush.sendNotification).toHaveBeenCalled());
        const [, body] = vi.mocked(webPush.sendNotification).mock.calls[0];
        const payload = JSON.parse(body as string);
        expect(payload.body).toBe("New message");
        expect(body).not.toContain(ciphertext);
    });

    test("encrypted messages never show up in server search", async () => {
        const res = await alice.agent.get("/api/messages/search").query({ q: "plain" });
        expect(res.body.every((r) => !r.message.includes(ciphertext))).toBe(true);
    });
});

describe("group chats", () => {
    let owner, member, other, groupId;

    beforeAll(async () => {
        [owner, member, other] = await Promise.all([createUser(), createUser(), createUser()]);
        await Promise.all([setUpKey(owner), setUpKey(member), setUpKey(other)]);
        const res = await owner.agent
            .post("/api/groups/create")
            .send({ name: "Secret club", participants: [member.user._id, other.user._id] });
        groupId = res.body._id;
    });

    const url = (path) => `/api/groups/${groupId}${path}`;

    test("the first sender makes the key for all three", async () => {
        const info = (await chatKeys(owner, groupId)).body;
        expect(info).toMatchObject({ ready: true, epoch: null });
        expect(info.members).toHaveLength(3);

        const res = await send(owner, groupId, sealed(1, { newKey: newKeyFor(info) }));
        expect(res.status).toBe(201);
    });

    test("removing a member retires the key, so they never get the next one", async () => {
        await owner.agent.put(url("/participants/remove")).send({ userIdToRemove: other.user._id });

        const info = (await chatKeys(member, groupId)).body;
        expect(info).toMatchObject({ epoch: 1, current: false });
        expect(info.members.map((m) => m._id)).not.toContain(other.user._id);

        expect((await send(member, groupId, sealed(1))).status).toBe(409);

        // A new key that still includes the removed member is refused
        const withOther = newKeyFor(info);
        withOther.envelopes.push({ ...withOther.envelopes[0], userId: other.user._id });
        expect((await send(member, groupId, sealed(2, { newKey: withOther }))).status).toBe(409);

        const res = await send(member, groupId, sealed(2, { newKey: newKeyFor(info) }));
        expect(res.status).toBe(201);

        // And the removed member can't ask for the keys any more
        expect((await chatKeys(other, groupId)).status).toBe(404);
    });

    test("adding a member also needs a new key", async () => {
        await owner.agent.put(url("/participants/add")).send({ userIdToAdd: other.user._id });
        const info = (await chatKeys(other, groupId)).body;
        expect(info).toMatchObject({ epoch: 2, current: false });
        // They still hold the key from before they left, but not the one
        // made while they were out, so those messages stay closed to them
        expect(info.keys.map((k) => k.epoch)).toEqual([1]);
    });

    test("system messages stay readable to the server", async () => {
        const history = await owner.agent.get(`/api/messages/${groupId}`);
        const system = history.body.filter((m) => m.isSystem);
        expect(system.length).toBeGreaterThan(0);
        expect(system.every((m) => !m.e2ee && m.message.length > 0)).toBe(true);
    });
});
