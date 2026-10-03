import { beforeEach, describe, expect, test, vi } from "vitest";
import useConversation, { placeMessage } from "./useConversation";
import { addMessageToCache, updateMessageInCache } from "../utils/messageCacheDB";
import type { Conversation, Message, PublicUser } from "../types";

vi.mock("../utils/messageCacheDB", () => ({
    addMessageToCache: vi.fn(),
    updateMessageInCache: vi.fn(),
}));

// The store only reads a few fields, so tests build partial objects
const msg = (fields: Partial<Message>) => fields as Message;
const chat = (fields: Partial<Conversation>) => fields as Conversation;

const initialState = useConversation.getState();
const store = () => useConversation.getState();

beforeEach(() => {
    useConversation.setState(initialState, true);
    vi.clearAllMocks();
});

describe("messages", () => {
    test("addMessage appends once and caches it for the open chat", () => {
        store().setSelectedConversation(chat({ _id: "chat1" }));
        store().addMessage(msg({ _id: "m1", message: "hi" }));
        store().addMessage(msg({ _id: "m1", message: "hi" }));

        expect(store().messages).toEqual([{ _id: "m1", message: "hi" }]);
        expect(addMessageToCache).toHaveBeenCalledWith("chat1", { _id: "m1", message: "hi" });
    });

    test("addMessage without an open chat skips the cache", () => {
        store().addMessage(msg({ _id: "m1" }));
        expect(store().messages).toHaveLength(1);
        expect(addMessageToCache).not.toHaveBeenCalled();
    });

    test("setMessages takes an updater function, used when older pages load", () => {
        store().setMessages([msg({ _id: "m2" })]);
        store().setMessages((prev) => [msg({ _id: "m1" }), ...prev]);

        expect(store().messages).toEqual([{ _id: "m1" }, { _id: "m2" }]);
    });

    test("updateMessage swaps the matching message and updates the cache", () => {
        store().setSelectedConversation(chat({ _id: "chat1" }));
        store().setMessages([msg({ _id: "m1", message: "old" }), msg({ _id: "m2", message: "other" })]);
        store().updateMessage(msg({ _id: "m1", message: "new", isEdited: true }));

        expect(store().messages).toEqual([
            { _id: "m1", message: "new", isEdited: true },
            { _id: "m2", message: "other" },
        ]);
        expect(updateMessageInCache).toHaveBeenCalledWith("chat1", { _id: "m1", message: "new", isEdited: true });
    });

    test("removeMessage drops it by id", () => {
        store().setMessages([msg({ _id: "m1" }), msg({ _id: "m2" })]);
        store().removeMessage("m1");
        expect(store().messages).toEqual([{ _id: "m2" }]);
    });

    test("markMessagesRead marks only messages the reader didn't send", () => {
        store().setMessages([
            msg({ _id: "m1", senderId: "me", status: "sent" }),
            msg({ _id: "m2", senderId: { _id: "reader" } as PublicUser, status: "sent" }),
            msg({ _id: "m3", senderId: "me", status: "read" }),
        ]);
        store().markMessagesRead("reader");

        expect(store().messages.map((m) => m.status)).toEqual(["read", "sent", "read"]);
    });

    test("markMessagesRead keeps unchanged messages as the same objects", () => {
        const already = msg({ _id: "m1", senderId: "me", status: "read" });
        store().setMessages([already]);
        store().markMessagesRead("reader");
        expect(store().messages[0]).toBe(already);
    });
});

describe("message order and delivery", () => {
    const ids = (list: Message[]) => list.map((m) => m._id);

    test("placeMessage puts a late arrival in sequence order", () => {
        const list = [msg({ _id: "a", seq: 1 }), msg({ _id: "c", seq: 3 })];
        expect(ids(placeMessage(list, msg({ _id: "b", seq: 2 })))).toEqual(["a", "b", "c"]);
        expect(ids(placeMessage(list, msg({ _id: "d", seq: 4 })))).toEqual(["a", "c", "d"]);
    });

    test("placeMessage keeps unsent messages at the end", () => {
        const list = [msg({ _id: "a", seq: 1 }), msg({ _id: "p", clientId: "p", pending: true })];
        expect(ids(placeMessage(list, msg({ _id: "b", seq: 2 })))).toEqual(["a", "b", "p"]);
        expect(ids(placeMessage(list, msg({ _id: "q", pending: true })))).toEqual(["a", "p", "q"]);
    });

    test("the saved message replaces its optimistic copy by client id", () => {
        const list = [msg({ _id: "a", seq: 1 }), msg({ _id: "tmp", clientId: "tmp", pending: true })];
        const next = placeMessage(list, msg({ _id: "real", clientId: "tmp", seq: 2 }));
        expect(next).toHaveLength(2);
        expect(next[1]).toMatchObject({ _id: "real", seq: 2 });
        expect(next[1].pending).toBeUndefined();
    });

    test("an echo of a message already shown doesn't shake it again", () => {
        const list = [msg({ _id: "a", seq: 1 })];
        const next = placeMessage(list, msg({ _id: "a", seq: 1, shouldShake: true }));
        expect(next[0].shouldShake).toBeUndefined();
    });

    test("addMessage keeps unsent messages out of the cache", () => {
        store().setSelectedConversation(chat({ _id: "chat1" }));
        store().addMessage(msg({ _id: "tmp", pending: true }));
        expect(addMessageToCache).not.toHaveBeenCalled();
    });

    test("dropMessage removes only the unsent copy", () => {
        store().setMessages([
            msg({ _id: "a", clientId: "x" }),
            msg({ _id: "x", clientId: "x", pending: true }),
        ]);
        store().dropMessage("x");
        expect(ids(store().messages)).toEqual(["a"]);
    });

    test("a read receipt marks messages up to its sequence number", () => {
        store().setMessages([
            msg({ _id: "a", senderId: "me", status: "sent", seq: 1 }),
            msg({ _id: "b", senderId: "me", status: "sent", seq: 2 }),
            msg({ _id: "c", senderId: "me", status: "sent", seq: 3 }),
            msg({ _id: "d", senderId: "me", status: "sent", pending: true }),
        ]);
        store().markMessagesRead("reader", 2);
        expect(store().messages.map((m) => m.status)).toEqual(["read", "read", "sent", "sent"]);
    });
});

describe("typing", () => {
    test("each user is listed once and can be removed", () => {
        store().addTypingUser("u1");
        store().addTypingUser("u1");
        store().addTypingUser("u2");
        expect(store().typingUsers).toEqual(["u1", "u2"]);

        store().removeTypingUser("u1");
        expect(store().typingUsers).toEqual(["u2"]);
    });
});

describe("conversations", () => {
    test("new conversations go to the top", () => {
        store().setConversations([chat({ _id: "c1" })]);
        store().addConversation(chat({ _id: "c2" }));
        expect(store().conversations.map((c) => c._id)).toEqual(["c2", "c1"]);
    });

    test("updateConversation merges into the matching one", () => {
        store().setConversations([chat({ _id: "c1", groupName: "Old", admins: ["a"] }), chat({ _id: "c2" })]);
        store().updateConversation({ _id: "c1", groupName: "New" });
        expect(store().conversations[0]).toEqual({ _id: "c1", groupName: "New", admins: ["a"] });
        expect(store().conversations[1]).toEqual({ _id: "c2" });
    });
});

describe("unread", () => {
    test("a new message becomes the preview and counts when unread", () => {
        store().setConversations([chat({ _id: "c1" }), chat({ _id: "c2", unreadCount: 2 })]);
        store().noteMessage(msg({ _id: "m1", receiverId: "c1", seq: 1, createdAt: "2026-01-01T00:00:00.000Z" }), true);
        store().noteMessage(msg({ _id: "m2", receiverId: "c1", seq: 2 }), true);
        store().noteMessage(msg({ _id: "m3", receiverId: "c2", seq: 9 }));

        const [c1, c2] = store().conversations;
        expect(c1.unreadCount).toBe(2);
        expect(c1.lastMessage?._id).toBe("m2");
        expect(c2.unreadCount).toBe(2);
        expect(c2.lastMessage?._id).toBe("m3");

        store().clearUnread("c1");
        expect(store().conversations.map((c) => c.unreadCount)).toEqual([0, 2]);
    });

    test("an older message arriving late doesn't replace the preview", () => {
        store().setConversations([chat({ _id: "c1", lastMessage: msg({ _id: "m5", seq: 5 }) })]);
        store().noteMessage(msg({ _id: "m4", receiverId: "c1", seq: 4 }), true);
        expect(store().conversations[0].lastMessage?._id).toBe("m5");
        expect(store().conversations[0].unreadCount).toBe(1);
    });

    test("an edit updates the preview only when it shows that message", () => {
        store().setConversations([chat({ _id: "c1", lastMessage: msg({ _id: "m1", message: "old" }) })]);
        store().refreshPreview(msg({ _id: "m0", message: "other" }));
        expect(store().conversations[0].lastMessage?.message).toBe("old");
        store().refreshPreview(msg({ _id: "m1", message: "new" }));
        expect(store().conversations[0].lastMessage?.message).toBe("new");
    });
});
