import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { notifications } from "@mantine/notifications";
import useConversation from "../zustand/useConversation";
import { addToOutbox, clearAllMessages, getOutbox } from "./messageCacheDB";
import { flushOutbox, stopOutboxRetries } from "./outbox";
import type { Conversation, Message } from "../types";

vi.mock("@mantine/notifications", () => ({ notifications: { show: vi.fn() } }));
// Chats here aren't end to end; chats.test.ts covers the sealing
vi.mock("./e2ee/chats", () => ({
    sendSealed: (_id: string, text: string, send: (fields: { message: string }) => Promise<Response>) =>
        send({ message: text }),
    openMessage: async (message: unknown) => message,
}));

const store = () => useConversation.getState();
const initialState = useConversation.getState();

const queue = async (clientId: string, createdAt: number, targetId = "chat1") => {
    const message = { _id: clientId, clientId, pending: true, message: clientId } as Message;
    await addToOutbox({ clientId, targetId, body: { message: clientId, clientId }, message, createdAt });
    store().setMessages((prev) => [...prev, message]);
};

const saved = (clientId: string, seq: number) => ({
    _id: `saved-${clientId}`,
    clientId,
    seq,
    receiverId: "chat1",
    message: clientId,
    createdAt: new Date().toISOString(),
});

const reply = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(async () => {
    await clearAllMessages();
    useConversation.setState(initialState, true);
    store().setSelectedConversation({ _id: "chat1" } as Conversation);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.clearAllMocks();
});

afterEach(() => {
    stopOutboxRetries();
    vi.unstubAllGlobals();
});

describe("flushOutbox", () => {
    test("sends queued messages in order and swaps in the saved copies", async () => {
        await queue("a", 1);
        await queue("b", 2);
        fetchMock
            .mockImplementationOnce(() => reply(201, { newMessage: saved("a", 1) }))
            .mockImplementationOnce(() => reply(201, { newMessage: saved("b", 2) }));

        await flushOutbox("me");

        const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(init?.body as string).clientId);
        expect(bodies).toEqual(["a", "b"]);
        expect(store().messages.map((m) => [m._id, m.pending])).toEqual([
            ["saved-a", undefined],
            ["saved-b", undefined],
        ]);
        expect(await getOutbox()).toEqual([]);
    });

    test("keeps messages queued while offline, and stops at the first one", async () => {
        await queue("a", 1);
        await queue("b", 2);
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

        await flushOutbox("me");

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect((await getOutbox()).map((e) => e.clientId)).toEqual(["a", "b"]);
        expect(store().messages.every((m) => m.pending)).toBe(true);
    });

    test("retries later when the server is down", async () => {
        // Only the retry timer; IndexedDB needs the real setImmediate
        vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
        try {
            await queue("a", 1);
            fetchMock
                .mockImplementationOnce(() => reply(503, { error: "down" }))
                .mockImplementationOnce(() => reply(201, { newMessage: saved("a", 1) }));

            await flushOutbox("me");
            expect(await getOutbox()).toHaveLength(1);

            await vi.advanceTimersByTimeAsync(2000);
            await vi.waitFor(async () => expect(await getOutbox()).toEqual([]));
            expect(fetchMock).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });

    test("drops a message the server turns down and says why", async () => {
        await queue("a", 1);
        fetchMock.mockImplementationOnce(() => reply(403, { error: "You cannot message a private user." }));

        await flushOutbox("me");

        expect(store().messages).toEqual([]);
        expect(await getOutbox()).toEqual([]);
        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({ message: "You cannot message a private user." }),
        );
    });

    test("the first message to someone switches to the new chat", async () => {
        const stand_in = { _id: "bob", participantId: "bob", isGroupChat: false } as Conversation;
        store().setSelectedConversation(stand_in);
        await queue("a", 1, "bob");
        fetchMock.mockImplementationOnce(() =>
            reply(201, {
                newMessage: saved("a", 1),
                newConversation: {
                    _id: "chat1",
                    participants: [
                        { _id: "me", fullName: "Me" },
                        { _id: "bob", fullName: "Bob" },
                    ],
                },
            }),
        );

        await flushOutbox("me");

        expect(store().selectedConversation).toMatchObject({ _id: "chat1", participantId: "bob", fullName: "Bob" });
        expect(store().conversations.map((c) => c._id)).toEqual(["chat1"]);
        expect(store().messages.map((m) => m._id)).toEqual(["saved-a"]);
    });
});
