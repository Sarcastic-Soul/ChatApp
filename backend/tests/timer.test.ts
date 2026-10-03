import { beforeEach, describe, expect, test } from "vitest";
import Message from "../models/message.model.ts";
import { createUser } from "./helpers.ts";

let alice, bob, chatId;

const send = (sender, id, body) => sender.agent.post(`/api/messages/send/${id}`).send(body);
const setTimer = (person, id, seconds) => person.agent.put(`/api/messages/timer/${id}`).send({ seconds });
const chatOf = async (person) =>
    (await person.agent.get("/api/users/conversations")).body.find((c) => c._id === chatId);

beforeEach(async () => {
    [alice, bob] = await Promise.all([createUser({ fullName: "Alice Timer" }), createUser()]);
    const res = await send(alice, bob.user._id, { message: "kept" });
    chatId = res.body.newConversation._id;
});

describe("disappearing messages", () => {
    test("new messages get an expiry time once the timer is on", async () => {
        const res = await setTimer(bob, chatId, 3600);
        expect(res.status).toBe(200);
        expect((await chatOf(alice)).disappearAfter).toBe(3600);

        const sent = await send(alice, chatId, { message: "goes away" });
        const left = new Date(sent.body.newMessage.expiresAt).getTime() - Date.now();
        expect(left).toBeGreaterThan(3590_000);
        expect(left).toBeLessThanOrEqual(3600_000);

        // Messages from before the timer are kept
        const kept = await Message.findOne({ receiverId: chatId, seq: 1 });
        expect(kept.expiresAt).toBeUndefined();
    });

    test("changing the timer leaves a notice that stays", async () => {
        await setTimer(alice, chatId, 86400);
        await setTimer(alice, chatId, 0);
        // Setting the same value again says nothing
        await setTimer(alice, chatId, 0);

        const res = await alice.agent.get(`/api/messages/${chatId}`);
        const notices = res.body.filter((m) => m.isSystem).map((m) => m.message);
        expect(notices).toEqual([
            "turned off disappearing messages",
            "set messages to disappear after 1 day",
        ]);
        expect(res.body.filter((m) => m.isSystem).every((m) => !m.expiresAt)).toBe(true);
    });

    test("an expired message is gone from the chat, search and the chat list", async () => {
        await setTimer(alice, chatId, 3600);
        const sent = await send(alice, chatId, { message: "pineapple secret" });
        await Message.updateOne({ _id: sent.body.newMessage._id }, { expiresAt: new Date(Date.now() - 1000) });

        const messages = await bob.agent.get(`/api/messages/${chatId}`);
        expect(messages.body.map((m) => m.message)).not.toContain("pineapple secret");
        const search = await bob.agent.get("/api/messages/search?q=pineapple");
        expect(search.body).toEqual([]);
        expect((await chatOf(bob)).lastMessage).toBeNull();
    });

    test("only a listed length is accepted, and only from a member", async () => {
        expect((await setTimer(alice, chatId, 120)).status).toBe(400);
        const outsider = await createUser();
        expect((await setTimer(outsider, chatId, 3600)).status).toBe(404);
    });

    test("in a group only admins can change it", async () => {
        const group = await alice.agent.post("/api/groups/create").send({ name: "Timed", participants: [bob.user._id] });
        expect((await setTimer(bob, group.body._id, 3600)).status).toBe(403);
        expect((await setTimer(alice, group.body._id, 3600)).status).toBe(200);
    });

    test("the collection has a TTL index on the expiry time", async () => {
        await Message.syncIndexes();
        const indexes = await Message.collection.indexes();
        expect(indexes.find((i) => i.key.expiresAt === 1)?.expireAfterSeconds).toBe(0);
    });
});
