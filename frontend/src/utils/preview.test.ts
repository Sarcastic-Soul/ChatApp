import { describe, expect, it } from "vitest";
import { previewText, unreadLabel } from "./preview";
import type { Conversation, Message } from "../types";

const message = (fields: Partial<Message>): Message => ({
    _id: "m1",
    senderId: "bob",
    receiverId: "c1",
    message: "",
    mediaUrl: null,
    mediaType: "text",
    status: "sent",
    isEdited: false,
    isDeleted: false,
    isCall: false,
    isForwarded: false,
    isSystem: false,
    replyTo: null,
    reactions: [],
    createdAt: "",
    updatedAt: "",
    ...fields,
});

const chat = (last: Partial<Message> | null, fields: Partial<Conversation> = {}): Conversation => ({
    _id: "c1",
    isGroupChat: false,
    lastMessage: last && message(last),
    ...fields,
});

const group = {
    isGroupChat: true,
    participants: [{ _id: "bob", fullName: "Bob Johnson", username: "bob", profilePic: "", isPublic: true }],
};

describe("previewText", () => {
    it("shows the text, marked when it's the user's own", () => {
        expect(previewText(chat({ message: "hello" }), "alice")).toBe("hello");
        expect(previewText(chat({ message: "hello", senderId: "alice" }), "alice")).toBe("You: hello");
    });

    it("names the sender in a group", () => {
        expect(previewText(chat({ message: "hello" }, group), "alice")).toBe("Bob: hello");
    });

    it("labels media that has no text", () => {
        expect(previewText(chat({ mediaType: "image" }), "alice")).toBe("Photo");
        expect(previewText(chat({ mediaType: "audio" }, group), "alice")).toBe("Bob: Voice message");
        expect(previewText(chat({ mediaType: "image", message: "look" }), "alice")).toBe("look");
    });

    it("shows nothing for a message whose timer ran out", () => {
        expect(previewText(chat({ message: "gone", expiresAt: "2020-01-01T00:00:00.000Z" }), "alice")).toBe("");
    });

    it("reads group notices as a sentence and deleted messages as they are", () => {
        expect(previewText(chat({ message: "left the group", isSystem: true }, group), "alice")).toBe(
            "Bob left the group",
        );
        expect(previewText(chat({ message: "renamed the group", isSystem: true, senderId: "alice" }, group), "alice")).toBe(
            "You renamed the group",
        );
        expect(previewText(chat({ message: "This message was deleted", isDeleted: true, senderId: "alice" }), "alice")).toBe(
            "This message was deleted",
        );
    });

    it("hides text it can't read", () => {
        expect(previewText(chat({ message: "c2VhbGVk", e2ee: { epoch: 1, iv: "aXY=" } }), "alice")).toBe("");
        expect(previewText(chat({ undecryptable: true }), "alice")).toBe("Encrypted message");
        expect(previewText(chat(null), "alice")).toBe("");
    });
});

describe("unreadLabel", () => {
    it("caps at 99+", () => {
        expect(unreadLabel(3)).toBe("3");
        expect(unreadLabel(120)).toBe("99+");
    });
});
