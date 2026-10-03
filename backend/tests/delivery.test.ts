import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, test } from "vitest";
import { Types } from "mongoose";
import Conversation from "../models/conversation.model.ts";
import Message from "../models/message.model.ts";
import { createUser } from "./helpers.ts";

let alice, bob, chatId;

const send = (sender, id, body) => sender.agent.post(`/api/messages/send/${id}`).send(body);

// New people for every test keep each one under the send rate limit
beforeEach(async () => {
    [alice, bob] = await Promise.all([createUser(), createUser()]);
    const res = await send(alice, bob.user._id, { message: "first" });
    chatId = res.body.newConversation._id;
});

describe("client message ids", () => {
    test("a retried send returns the saved message instead of a copy", async () => {
        const clientId = randomUUID();
        const first = await send(alice, chatId, { message: "only once", clientId });
        const retry = await send(alice, chatId, { message: "only once", clientId });

        expect(first.status).toBe(201);
        expect(retry.status).toBe(200);
        expect(retry.body.newMessage._id).toBe(first.body.newMessage._id);
        expect(retry.body.newMessage).toMatchObject({ message: "only once", clientId });

        expect(await Message.countDocuments({ clientId })).toBe(1);
        expect(await Message.countDocuments({ receiverId: chatId })).toBe(2);
    });

    test("two copies of a send arriving at once are saved once", async () => {
        const clientId = randomUUID();
        const results = await Promise.all([
            send(alice, chatId, { message: "racing", clientId }),
            send(alice, chatId, { message: "racing", clientId }),
        ]);

        const ids = new Set(results.map((res) => res.body.newMessage._id));
        expect(ids.size).toBe(1);
        expect(await Message.countDocuments({ clientId })).toBe(1);

        // The chat list preview points at the copy that was saved
        const conversation = await Conversation.findById(chatId);
        expect(conversation.lastMessage.toString()).toBe([...ids][0]);
        // "first" and one copy of "racing"
        expect(conversation.unread.get(bob.user._id)).toBe(2);
    });

    test("the same client id from two people makes two messages", async () => {
        const clientId = randomUUID();
        await send(alice, chatId, { message: "from alice", clientId });
        const res = await send(bob, chatId, { message: "from bob", clientId });
        expect(res.status).toBe(201);
        expect(await Message.countDocuments({ clientId })).toBe(2);
    });

    test("a retry of a first message still returns the new chat", async () => {
        const carol = await createUser();
        const clientId = randomUUID();
        const first = await send(alice, carol.user._id, { message: "hi carol", clientId });
        const retry = await send(alice, carol.user._id, { message: "hi carol", clientId });
        expect(retry.body.newConversation._id).toBe(first.body.newConversation._id);
    });

    test("rejects a client id that isn't a UUID", async () => {
        const res = await send(alice, chatId, { message: "x", clientId: "abc" });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Client id must be a UUID");
    });
});

describe("sequence numbers", () => {
    test("each message in a chat gets the next number", async () => {
        const second = await send(bob, chatId, { message: "second" });
        const third = await send(alice, chatId, { message: "third" });
        expect(second.body.newMessage.seq).toBe(2);
        expect(third.body.newMessage.seq).toBe(3);
    });

    test("messages sent at the same moment never share a number", async () => {
        const results = await Promise.all(
            ["a", "b", "c", "d", "e"].map((text) => send(alice, chatId, { message: text })),
        );
        const seqs = results.map((res) => res.body.newMessage.seq).sort((a, b) => a - b);
        expect(seqs).toEqual([2, 3, 4, 5, 6]);
    });

    test("group system messages are numbered too", async () => {
        const group = await alice.agent
            .post("/api/groups/create")
            .send({ name: "Numbered", participants: [bob.user._id] });
        const res = await send(bob, group.body._id, { message: "hello group" });

        const messages = await Message.find({ receiverId: group.body._id }).sort({ seq: 1 }).lean();
        expect(messages.map((m) => m.seq)).toEqual(messages.map((_m, i) => i + 1));
        expect(res.body.newMessage.seq).toBe(messages.length);
    });

    test("an older chat with no numbers is numbered in send order on first use", async () => {
        const senderId = new Types.ObjectId(alice.user._id);
        const old = await Message.collection.insertMany(
            [3, 1, 2].map((minute) => ({
                senderId,
                receiverId: new Types.ObjectId(),
                message: "",
                mediaUrl: "https://example.com/old.png",
                mediaType: "image",
                createdAt: new Date(Date.UTC(2024, 0, 1, 0, minute)),
            })),
        );
        const ids = Object.values(old.insertedIds);
        const { insertedId } = await Conversation.collection.insertOne({
            participants: [senderId, new Types.ObjectId(bob.user._id)],
            isGroupChat: false,
        });
        await Message.updateMany({ _id: { $in: ids } }, { receiverId: insertedId });

        const res = await alice.agent.get(`/api/messages/${insertedId}`);
        expect(res.status).toBe(200);
        // Newest first: minute 3, 2, 1
        expect(res.body.map((m) => m.seq)).toEqual([3, 2, 1]);
        expect(res.body[0]._id).toBe(ids[0].toString());

        const next = await send(alice, insertedId.toString(), { message: "new one" });
        expect(next.body.newMessage.seq).toBe(4);
    });

    test("after returns only newer messages, oldest first", async () => {
        for (const text of ["two", "three", "four"]) await send(bob, chatId, { message: text });

        const res = await alice.agent.get(`/api/messages/${chatId}?after=2`);
        expect(res.status).toBe(200);
        expect(res.body.map((m) => [m.seq, m.message])).toEqual([
            [3, "three"],
            [4, "four"],
        ]);

        const none = await alice.agent.get(`/api/messages/${chatId}?after=4`);
        expect(none.body).toEqual([]);
    });

    test("before pages by sequence number", async () => {
        for (const text of ["two", "three"]) await send(bob, chatId, { message: text });
        const latest = await alice.agent.get(`/api/messages/${chatId}?limit=1`);
        const older = await alice.agent.get(`/api/messages/${chatId}?before=${latest.body[0]._id}`);
        expect(older.body.map((m) => m.seq)).toEqual([2, 1]);
    });

    test.each(["-1", "1.5", "abc"])("rejects after=%s", async (after) => {
        const res = await alice.agent.get(`/api/messages/${chatId}?after=${after}`);
        expect(res.status).toBe(400);
    });
});
