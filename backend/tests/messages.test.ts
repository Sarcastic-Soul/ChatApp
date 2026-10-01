import { beforeAll, describe, expect, test, vi } from "vitest";
import Conversation from "../models/conversation.model.ts";
import Message from "../models/message.model.ts";
import { createUser, missingId } from "./helpers.ts";

let alice, bob, carol;
let chatId;

const send = (sender, id, body) => sender.agent.post(`/api/messages/send/${id}`).send(body);

beforeAll(async () => {
    [alice, bob, carol] = await Promise.all([createUser(), createUser(), createUser()]);

    // Messaging a user id for the first time starts a 1-on-1 chat
    const res = await send(alice, bob.user._id, { message: "hi bob" });
    expect(res.status).toBe(201);
    chatId = res.body.newConversation._id;
});

describe("sending messages", () => {
    test("the first message to a user creates the conversation", async () => {
        const conversation = await Conversation.findById(chatId);
        expect(conversation.isGroupChat).toBe(false);
        expect(conversation.participants.map(String).sort()).toEqual(
            [alice.user._id, bob.user._id].sort(),
        );
    });

    test("later messages to the same user reuse the conversation", async () => {
        const res = await send(bob, alice.user._id, { message: "hey alice" });
        expect(res.status).toBe(201);
        expect(res.body.newConversation._id).toBe(chatId);
        expect(res.body.newMessage.receiverId).toBe(chatId);
    });

    test("text is stored encrypted and returned as plain text", async () => {
        const res = await send(alice, chatId, { message: "secret plans" });
        expect(res.body.newMessage.message).toBe("secret plans");

        const stored = await Message.findById(res.body.newMessage._id).lean();
        expect(stored.message).not.toContain("secret plans");
        expect(stored.message).toMatch(/^[a-f\d]{32}:[a-f\d]+$/);
    });

    test("profanity is masked before saving", async () => {
        const res = await send(alice, chatId, { message: "this is shit" });
        expect(res.body.newMessage.message).toBe("this is ****");
    });

    test("a media message can have no text", async () => {
        const res = await send(alice, chatId, {
            mediaUrl: "https://res.cloudinary.com/demo/image/upload/cat.jpg",
            mediaType: "image",
        });
        expect(res.status).toBe(201);
        expect(res.body.newMessage).toMatchObject({ message: "", mediaType: "image" });
    });

    test("clients can't create system messages", async () => {
        const res = await send(alice, chatId, { message: "fake system note", isSystem: true });
        expect(res.status).toBe(201);
        expect(res.body.newMessage.isSystem).toBe(false);
    });

    test("a reply quotes the original message", async () => {
        const original = await send(bob, chatId, { message: "original" });
        const reply = await send(alice, chatId, {
            message: "reply",
            replyTo: original.body.newMessage._id,
        });
        expect(reply.status).toBe(201);
        expect(reply.body.newMessage.replyTo.message).toBe("original");
    });

    test("a reply can't quote a message from another chat", async () => {
        const other = await send(carol, bob.user._id, { message: "carol's private note" });
        const res = await send(alice, chatId, {
            message: "peek",
            replyTo: other.body.newMessage._id,
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("You can only reply to messages in this chat.");
    });

    test("you can't message yourself", async () => {
        const res = await send(alice, alice.user._id, { message: "note to self" });
        expect(res.status).toBe(400);
    });

    test("you can't post into a chat you are not in", async () => {
        const res = await send(carol, chatId, { message: "let me in" });
        expect(res.status).toBe(403);
    });

    test("messaging a user that doesn't exist is 404", async () => {
        const res = await send(alice, missingId, { message: "anyone?" });
        expect(res.status).toBe(404);
    });

    test("private users can't get new messages", async () => {
        const dave = await createUser();
        await dave.agent.put("/api/users/privacy").send({ isPublic: false });
        const res = await send(alice, dave.user._id, { message: "hello" });
        expect(res.status).toBe(403);
    });

    test.each([
        ["an empty message", { message: "   " }, "Message can't be empty"],
        ["a message over 5000 characters", { message: "a".repeat(5001) }, "Messages must be 5000 characters or fewer"],
        ["a non-https media link", { mediaUrl: "javascript:alert(1)", mediaType: "image" }, "Media must be an https link"],
        ["an unknown media type", { message: "x", mediaType: "exe" }, undefined],
        ["a bad reply id", { message: "x", replyTo: "nope" }, "Reply is not a valid id"],
    ])("rejects %s", async (_name, body, error) => {
        const res = await send(alice, chatId, body);
        expect(res.status).toBe(400);
        if (error) expect(res.body.error).toBe(error);
    });

    test("rejects a bad conversation id", async () => {
        const res = await send(alice, "not-an-id", { message: "x" });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Conversation id is not a valid id");
    });
});

describe("reading messages", () => {
    test("returns the newest messages first", async () => {
        const res = await alice.agent.get(`/api/messages/${chatId}`);
        expect(res.status).toBe(200);
        const times = res.body.map((m) => new Date(m.createdAt).getTime());
        expect(times).toEqual([...times].sort((a, b) => b - a));
        expect(res.body.every((m) => !m.message.includes(":"))).toBe(true);
    });

    test("limit and before page through older messages", async () => {
        const firstPage = await alice.agent.get(`/api/messages/${chatId}?limit=2`);
        expect(firstPage.body).toHaveLength(2);

        const oldest = firstPage.body.at(-1);
        const secondPage = await alice.agent.get(`/api/messages/${chatId}?limit=2&before=${oldest._id}`);
        expect(secondPage.body).toHaveLength(2);
        expect(new Date(secondPage.body[0].createdAt) <= new Date(oldest.createdAt)).toBe(true);
        expect(secondPage.body.map((m) => m._id)).not.toContain(oldest._id);
    });

    test.each(["0", "101", "abc"])("rejects limit=%s", async (limit) => {
        const res = await alice.agent.get(`/api/messages/${chatId}?limit=${limit}`);
        expect(res.status).toBe(400);
    });

    test("people outside the chat get 404", async () => {
        const res = await carol.agent.get(`/api/messages/${chatId}`);
        expect(res.status).toBe(404);
    });

    test("mark as read updates the other person's messages", async () => {
        const res = await alice.agent.post(`/api/messages/read/${chatId}`);
        expect(res.status).toBe(200);

        const fromBob = await Message.find({ receiverId: chatId, senderId: bob.user._id });
        expect(fromBob.length).toBeGreaterThan(0);
        expect(fromBob.every((m) => m.status === "read")).toBe(true);

        const fromAlice = await Message.find({ receiverId: chatId, senderId: alice.user._id });
        expect(fromAlice.some((m) => m.status === "sent")).toBe(true);
    });
});

describe("reactions, edits and deletes", () => {
    let messageId;

    beforeAll(async () => {
        const res = await send(bob, chatId, { message: "react to me" });
        messageId = res.body.newMessage._id;
    });

    test("reacting twice with the same emoji removes it", async () => {
        const first = await alice.agent.post(`/api/messages/react/${messageId}`).send({ reaction: "👍" });
        expect(first.body.reactions).toEqual([{ userId: alice.user._id, reaction: "👍" }]);
        expect(first.body.message).toBe("react to me");

        const second = await alice.agent.post(`/api/messages/react/${messageId}`).send({ reaction: "👍" });
        expect(second.body.reactions).toEqual([]);
    });

    test("a new emoji replaces the old one", async () => {
        await alice.agent.post(`/api/messages/react/${messageId}`).send({ reaction: "👍" });
        const res = await alice.agent.post(`/api/messages/react/${messageId}`).send({ reaction: "❤️" });
        expect(res.body.reactions).toEqual([{ userId: alice.user._id, reaction: "❤️" }]);
    });

    test("people outside the chat can't react", async () => {
        const res = await carol.agent.post(`/api/messages/react/${messageId}`).send({ reaction: "👀" });
        expect(res.status).toBe(404);
    });

    test("the sender can edit a message", async () => {
        const res = await bob.agent.put(`/api/messages/edit/${messageId}`).send({ message: "edited text" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ message: "edited text", isEdited: true });
    });

    test("nobody else can edit it", async () => {
        const res = await alice.agent.put(`/api/messages/edit/${messageId}`).send({ message: "hacked" });
        expect(res.status).toBe(403);
    });

    test("an edit can't be empty", async () => {
        const res = await bob.agent.put(`/api/messages/edit/${messageId}`).send({ message: "  " });
        expect(res.status).toBe(400);
    });

    test("only the sender can delete, and the text is replaced", async () => {
        const denied = await alice.agent.delete(`/api/messages/delete/${messageId}`);
        expect(denied.status).toBe(403);

        const res = await bob.agent.delete(`/api/messages/delete/${messageId}`);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ isDeleted: true, message: "This message was deleted" });
    });

    test("editing a missing message is 404", async () => {
        const res = await bob.agent.put(`/api/messages/edit/${missingId}`).send({ message: "x" });
        expect(res.status).toBe(404);
    });
});

describe("magic reply", () => {
    const groqReply = (content, status = 200) =>
        new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
            status,
            headers: { "Content-Type": "application/json" },
        });

    test("sends the last 10 messages to Groq and returns the draft", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(groqReply('"Sounds good, see you then"'));

        const messages = Array.from({ length: 12 }, (_, i) => ({ sender: i % 2 ? "Me" : "Bob", text: `line ${i}` }));
        const res = await alice.agent
            .post("/api/messages/magic-reply")
            .send({ messages, requestedTone: "Casual" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ reply: "Sounds good, see you then" });

        const [url, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];
        expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
        expect(options.headers.Authorization).toBe("Bearer test-groq-key");
        const body = JSON.parse(options.body);
        expect(body.model).toBe("openai/gpt-oss-120b");
        expect(body.messages[0].content).toContain("Use this tone: Casual.");
        expect(body.messages[1].content).not.toContain("line 1\n");
        expect(body.messages[1].content.split("\n")).toHaveLength(10);

        fetchMock.mockRestore();
    });

    test("passes Groq rate limits on as 429", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("slow down", { status: 429 }));
        vi.spyOn(console, "error").mockImplementation(() => {});

        const res = await alice.agent.post("/api/messages/magic-reply").send({ messages: [{ sender: "Bob", text: "hi" }] });
        expect(res.status).toBe(429);
        expect(res.body.error).toBe("Too many AI requests right now. Try again in a minute.");

        fetchMock.mockRestore();
        vi.restoreAllMocks();
    });

    test("an empty draft is a 502", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(groqReply("   "));
        const res = await alice.agent.post("/api/messages/magic-reply").send({ messages: [{ sender: "Bob", text: "hi" }] });
        expect(res.status).toBe(502);
        fetchMock.mockRestore();
    });

    test("needs at least one message", async () => {
        const res = await alice.agent.post("/api/messages/magic-reply").send({ messages: [] });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("No messages to reply to");
    });
});
