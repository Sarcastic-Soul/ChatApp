import { beforeEach, describe, expect, test, vi } from "vitest";
import useConversation from "./useConversation";
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
    test("set and clear per conversation", () => {
        store().setUnreadMessage("c1");
        store().setUnreadMessage("c2");
        store().clearUnreadMessage("c1");
        expect(store().unreadMessages).toEqual({ c2: true });
    });
});
