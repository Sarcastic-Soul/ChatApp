import { beforeAll, describe, expect, test } from "vitest";
import Message from "../models/message.model.ts";
import { matchesQuery, queryTokensFor, searchTokensFor, words } from "../utils/searchIndex.ts";
import { api, createUser } from "./helpers.ts";

describe("search index", () => {
    test("splits text into lowercase words without accents", () => {
        expect(words("Café at 7:30, OK?")).toEqual(["cafe", "at", "7", "30", "ok"]);
    });

    test("query tokens are a subset of the message tokens for prefixes", () => {
        const tokens = new Set(searchTokensFor("Meeting moved to Thursday"));
        for (const t of queryTokensFor("meet thurs")) expect(tokens.has(t)).toBe(true);
        expect(queryTokensFor("me").every((t) => tokens.has(t))).toBe(false);
    });

    test("tokens are hashes, not the words", () => {
        const tokens = searchTokensFor("secret plans");
        expect(tokens.join(" ")).not.toMatch(/secret|plans|sec/);
        expect(tokens.every((t) => t.length === 16)).toBe(true);
    });

    test("matchesQuery needs every query word to start a word", () => {
        expect(matchesQuery("Meeting moved to Thursday", "thu meet")).toBe(true);
        expect(matchesQuery("Meeting moved to Thursday", "eting")).toBe(false);
        expect(matchesQuery("go to the shop", "to")).toBe(true);
        expect(matchesQuery("tomorrow", "to")).toBe(false);
    });
});

describe("GET /api/messages/search", () => {
    let alice, bob, carol, bobUser, carolUser, chatWithBob;

    beforeAll(async () => {
        ({ agent: alice } = await createUser({ fullName: "Alice" }));
        ({ agent: bob, user: bobUser } = await createUser({ fullName: "Bob" }));
        ({ agent: carol, user: carolUser } = await createUser({ fullName: "Carol" }));

        const first = await alice.post(`/api/messages/send/${bobUser._id}`).send({ message: "Dinner at the Italian place on Friday?" });
        chatWithBob = first.body.newConversation._id;
        await bob.post(`/api/messages/send/${chatWithBob}`).send({ message: "Friday works. I'll book a table" });
        await alice.post(`/api/messages/send/${chatWithBob}`).send({ message: "Great, see you then" });
        // A chat Bob is not in
        await alice.post(`/api/messages/send/${carolUser._id}`).send({ message: "Friday is Bob's birthday, keep it quiet" });
    });

    test("needs a login and a query", async () => {
        expect((await api().get("/api/messages/search?q=friday")).status).toBe(401);
        expect((await bob.get("/api/messages/search")).status).toBe(400);
    });

    test("finds messages by word prefix, newest first, only in your chats", async () => {
        const res = await bob.get("/api/messages/search?q=frid");
        expect(res.status).toBe(200);
        expect(res.body.map((m) => m.message)).toEqual([
            "Friday works. I'll book a table",
            "Dinner at the Italian place on Friday?",
        ]);
        expect(res.body[0]).toMatchObject({ conversationId: chatWithBob, sender: { fullName: "Bob" } });
        expect(res.body[0].searchTokens).toBeUndefined();
    });

    test("needs every word to match", async () => {
        const res = await bob.get("/api/messages/search?q=friday table");
        expect(res.body.map((m) => m.message)).toEqual(["Friday works. I'll book a table"]);
    });

    test("other people's chats stay private", async () => {
        const res = await carol.get("/api/messages/search?q=birthday");
        expect(res.body).toHaveLength(1);
        expect((await bob.get("/api/messages/search?q=birthday")).body).toEqual([]);
    });

    test("ignores queries with no word of two letters or more", async () => {
        const res = await bob.get("/api/messages/search?q=a");
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test("stores hashes, never sends them, and keeps them in step with edits and deletes", async () => {
        const sent = await alice.post(`/api/messages/send/${chatWithBob}`).send({ message: "Pizza or pasta" });
        expect(sent.body.newMessage.searchTokens).toBeUndefined();
        const id = sent.body.newMessage._id;

        const stored = await Message.findById(id).select("+searchTokens");
        expect(stored.searchTokens.length).toBeGreaterThan(0);

        const edited = await alice.put(`/api/messages/edit/${id}`).send({ message: "Sushi instead" });
        expect(edited.status).toBe(200);
        expect(edited.body.searchTokens).toBeUndefined();
        expect((await bob.get("/api/messages/search?q=pizza")).body).toEqual([]);
        expect((await bob.get("/api/messages/search?q=sushi")).body.map((m) => m._id)).toEqual([id]);

        await alice.delete(`/api/messages/delete/${id}`);
        expect((await bob.get("/api/messages/search?q=sushi")).body).toEqual([]);
        expect((await Message.findById(id).select("+searchTokens")).searchTokens).toBeUndefined();
    });

    test("chat history does not include the tokens", async () => {
        const res = await bob.get(`/api/messages/${chatWithBob}`);
        expect(res.status).toBe(200);
        expect(res.body.every((m) => m.searchTokens === undefined)).toBe(true);
    });
});

describe("backfillSearchIndex", () => {
    test("indexes old messages once and leaves deleted ones alone", async () => {
        const { backfillSearchIndex } = await import("../utils/backfillSearchIndex.ts");
        const { encryptText } = await import("../utils/encryption.ts");
        const { agent, user } = await createUser();
        const { user: other } = await createUser();
        const sent = await agent.post(`/api/messages/send/${other._id}`).send({ message: "placeholder" });
        const { Types } = await import("mongoose");
        const receiverId = new Types.ObjectId(sent.body.newConversation._id);
        const senderId = new Types.ObjectId(user._id);

        // Messages as they were stored before search existed
        const old = await Message.collection.insertMany([
            { senderId, receiverId, message: encryptText("Old note about the harbour trip") },
            { senderId, receiverId, message: encryptText("This message was deleted"), isDeleted: true },
        ]);
        const [oldId, deletedId] = Object.values(old.insertedIds);

        const first = await backfillSearchIndex();
        expect(first.updated).toBeGreaterThanOrEqual(1);
        expect((await Message.findById(oldId).select("+searchTokens")).searchTokens.length).toBeGreaterThan(0);
        expect((await Message.findById(deletedId).select("+searchTokens")).searchTokens).toBeUndefined();

        const res = await agent.get("/api/messages/search?q=harbour");
        expect(res.body.map((m) => m._id)).toEqual([oldId.toString()]);

        expect((await backfillSearchIndex()).updated).toBe(0);
    });
});
