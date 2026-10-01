import { beforeEach, describe, expect, test } from "vitest";
import {
    addToOutbox,
    getOutbox,
    removeFromOutbox,
    addMessageToCache,
    addOlderMessages,
    clearAllMessages,
    getCachedMessage,
    getCachedMessages,
    setCachedMessages,
    updateMessageInCache,
} from "./messageCacheDB";
import type { Message } from "../types";

// The cache only reads _id, so tests store small partial messages
const msg = (id: string, text = `message ${id}`) => ({ _id: id, message: text }) as Message;

beforeEach(async () => {
    await clearAllMessages();
});

describe("message cache", () => {
    test("an unknown conversation has no messages", async () => {
        expect(await getCachedMessages("nothing")).toEqual([]);
    });

    test("set replaces what was cached", async () => {
        await setCachedMessages("c1", [msg("a"), msg("b")]);
        await setCachedMessages("c1", [msg("c")]);
        expect(await getCachedMessages("c1")).toEqual([msg("c")]);
    });

    test("conversations are kept apart", async () => {
        await setCachedMessages("c1", [msg("a")]);
        await setCachedMessages("c2", [msg("b")]);
        expect(await getCachedMessages("c1")).toEqual([msg("a")]);
        expect(await getCachedMessages("c2")).toEqual([msg("b")]);
    });

    test("new messages go at the end, without duplicates", async () => {
        await setCachedMessages("c1", [msg("a")]);
        await addMessageToCache("c1", msg("b"));
        await addMessageToCache("c1", msg("b"));
        expect((await getCachedMessages("c1")).map((m) => m._id)).toEqual(["a", "b"]);
    });

    test("a new message can start an empty cache", async () => {
        await addMessageToCache("fresh", msg("a"));
        expect(await getCachedMessages("fresh")).toEqual([msg("a")]);
    });

    test("older messages go at the start, skipping ones already cached", async () => {
        await setCachedMessages("c1", [msg("c"), msg("d")]);
        await addOlderMessages("c1", [msg("a"), msg("b"), msg("c")]);
        expect((await getCachedMessages("c1")).map((m) => m._id)).toEqual(["a", "b", "c", "d"]);
    });

    test("updates replace the matching message only", async () => {
        await setCachedMessages("c1", [msg("a"), msg("b")]);
        await updateMessageInCache("c1", { ...msg("b"), message: "edited", isEdited: true });
        expect(await getCachedMessages("c1")).toEqual([
            msg("a"),
            { _id: "b", message: "edited", isEdited: true },
        ]);
    });

    test("updating an uncached conversation does nothing", async () => {
        await updateMessageInCache("missing", msg("a"));
        expect(await getCachedMessages("missing")).toEqual([]);
    });

    test("finds a single cached message", async () => {
        await setCachedMessages("c1", [msg("a"), msg("b")]);
        expect(await getCachedMessage("c1", "b")).toEqual(msg("b"));
        expect(await getCachedMessage("c1", "zzz")).toBeUndefined();
    });

    test("clearing removes everything, and the cache still works after", async () => {
        await setCachedMessages("c1", [msg("a")]);
        await clearAllMessages();
        expect(await getCachedMessages("c1")).toEqual([]);

        await addMessageToCache("c1", msg("b"));
        expect(await getCachedMessages("c1")).toEqual([msg("b")]);
    });
});

describe("outbox", () => {
    const entry = (clientId: string, createdAt: number) => ({
        clientId,
        targetId: "c1",
        body: { message: clientId, clientId },
        message: msg(clientId),
        createdAt,
    });

    test("lists entries oldest first and removes them by client id", async () => {
        await addToOutbox(entry("second", 2));
        await addToOutbox(entry("first", 1));
        expect((await getOutbox()).map((e) => e.clientId)).toEqual(["first", "second"]);

        await removeFromOutbox("first");
        expect((await getOutbox()).map((e) => e.clientId)).toEqual(["second"]);
    });

    test("is emptied with the rest of the data on logout", async () => {
        await addToOutbox(entry("a", 1));
        await clearAllMessages();
        expect(await getOutbox()).toEqual([]);
    });
});
