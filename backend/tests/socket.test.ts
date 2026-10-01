import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { io as connect } from "socket.io-client";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { server } from "../app.ts";
import { createUser } from "./helpers.ts";

let url;
const sockets = [];

// Resolves with the next payload for `event`, or rejects after `ms`
const nextEvent = (socket, event, ms = 2000): Promise<any> =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`No "${event}" within ${ms}ms`)), ms);
        socket.once(event, (payload) => {
            clearTimeout(timer);
            resolve(payload);
        });
    });

// Resolves with the first payload for `event` that passes `check`
const eventMatching = (socket, event, check, ms = 2000) =>
    new Promise((resolve, reject) => {
        const handler = (payload) => {
            if (!check(payload)) return;
            clearTimeout(timer);
            socket.off(event, handler);
            resolve(payload);
        };
        const timer = setTimeout(() => {
            socket.off(event, handler);
            reject(new Error(`No matching "${event}" within ${ms}ms`));
        }, ms);
        socket.on(event, handler);
    });

// Resolves true if `event` does not arrive within `ms`
const noEvent = (socket, event, ms = 300) =>
    new Promise((resolve, reject) => {
        const handler = () => reject(new Error(`Unexpected "${event}"`));
        socket.once(event, handler);
        setTimeout(() => {
            socket.off(event, handler);
            resolve(true);
        }, ms);
    });

const open = (token) => {
    const socket = connect(url, { auth: { token }, transports: ["websocket"], reconnection: false });
    sockets.push(socket);
    return socket;
};

// Signs up a user and connects a socket for them
const onlineUser = async (overrides = {}) => {
    const user = await createUser(overrides);
    const { body } = await user.agent.get("/api/auth/socket-token");
    const socket = open(body.token);
    await nextEvent(socket, "connect");
    return { ...user, socket };
};

beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    url = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await new Promise((resolve) => server.close(resolve));
});

describe("handshake", () => {
    test("rejects a missing token", async () => {
        const error = await nextEvent(open(undefined), "connect_error");
        expect(error.message).toBe("Unauthorized");
    });

    test("rejects the long-lived login token", async () => {
        const token = jwt.sign({ userId: "0123456789abcdef01234567" }, process.env.JWT_SECRET);
        const error = await nextEvent(open(token), "connect_error");
        expect(error.message).toBe("Unauthorized");
    });

    test("rejects a token signed with another secret", async () => {
        const token = jwt.sign({ userId: "0123456789abcdef01234567", scope: "socket" }, "wrong-secret");
        const error = await nextEvent(open(token), "connect_error");
        expect(error.message).toBe("Unauthorized");
    });
});

describe("live events", () => {
    let alice, bob, carol, chatId;

    beforeAll(async () => {
        alice = await onlineUser({ fullName: "Alice" });
        bob = await onlineUser({ fullName: "Bob" });
        carol = await onlineUser({ fullName: "Carol" });

        const res = await alice.agent.post(`/api/messages/send/${bob.user._id}`).send({ message: "first" });
        chatId = res.body.newConversation._id;
    });

    test("online users are broadcast", async () => {
        const dave = await createUser();
        const { body } = await dave.agent.get("/api/auth/socket-token");
        const online = nextEvent(alice.socket, "getOnlineUsers");
        open(body.token);
        expect(await online).toEqual(expect.arrayContaining([alice.user._id, bob.user._id, dave.user._id]));
    });

    test("a new message reaches the receiver only", async () => {
        const received = nextEvent(bob.socket, "newMessage");
        const notCarol = noEvent(carol.socket, "newMessage");
        await alice.agent.post(`/api/messages/send/${chatId}`).send({ message: "live hello" });

        expect(await received).toMatchObject({ message: "live hello", receiverId: chatId });
        await notCarol;
    });

    test("a read receipt says how far the reader got", async () => {
        const sent = await alice.agent.post(`/api/messages/send/${chatId}`).send({ message: "read me" });
        const receipt = nextEvent(alice.socket, "messagesRead");
        await bob.agent.post(`/api/messages/read/${chatId}`);
        expect(await receipt).toEqual({
            conversationId: chatId,
            userId: bob.user._id,
            upToSeq: sent.body.newMessage.seq,
        });
    });

    test("typing is relayed with the real sender id", async () => {
        const typing = nextEvent(bob.socket, "typing");
        alice.socket.emit("typing", { conversationId: chatId, receiverId: bob.user._id });
        expect(await typing).toEqual({ conversationId: chatId, userId: alice.user._id });

        const stop = nextEvent(bob.socket, "stopTyping");
        alice.socket.emit("stopTyping", { conversationId: chatId, receiverId: bob.user._id });
        expect(await stop).toEqual({ conversationId: chatId, userId: alice.user._id });
    });

    test("bad payloads are dropped and the server keeps working", async () => {
        alice.socket.emit("typing", null);
        alice.socket.emit("typing", { conversationId: { $gt: "" } });
        alice.socket.emit("callUser", "garbage");
        alice.socket.emit("joinGroup", { $ne: null });

        const typing = nextEvent(bob.socket, "typing");
        alice.socket.emit("typing", { conversationId: chatId, receiverId: bob.user._id });
        expect(await typing).toMatchObject({ userId: alice.user._id });
    });

    test("call signals carry the caller's real id", async () => {
        const incoming = nextEvent(bob.socket, "incomingCall");
        alice.socket.emit("callUser", {
            userToCall: bob.user._id,
            signalData: { type: "offer", sdp: "v=0" },
            callerName: "Alice",
            callType: "audio",
            from: carol.user._id,
        });
        expect(await incoming).toEqual({
            signal: { type: "offer", sdp: "v=0" },
            from: alice.user._id,
            callerName: "Alice",
            callerPic: "",
            callType: "audio",
        });

        const accepted = nextEvent(alice.socket, "callAccepted");
        bob.socket.emit("answerCall", { to: alice.user._id, signal: { type: "answer" } });
        expect(await accepted).toEqual({ type: "answer" });

        const ended = nextEvent(bob.socket, "callEnded");
        alice.socket.emit("endCall", { to: bob.user._id });
        await ended;
    });

    test("group messages reach members who were added while online", async () => {
        const group = await alice.agent
            .post("/api/groups/create")
            .send({ name: "Live group", participants: [bob.user._id] });
        const groupId = group.body._id;

        const received = nextEvent(bob.socket, "newMessage");
        const notCarol = noEvent(carol.socket, "newMessage");
        await alice.agent.post(`/api/messages/send/${groupId}`).send({ message: "hi group" });

        expect(await received).toMatchObject({ message: "hi group", receiverId: groupId });
        await notCarol;
    });

    test("outsiders can't join a group room or type into it", async () => {
        const group = await alice.agent
            .post("/api/groups/create")
            .send({ name: "Closed group", participants: [bob.user._id] });
        const groupId = group.body._id;

        carol.socket.emit("joinGroup", groupId);
        const quiet = noEvent(bob.socket, "typing");
        carol.socket.emit("typing", { conversationId: groupId, isGroupChat: true });
        await quiet;

        const notCarol = noEvent(carol.socket, "newMessage");
        await alice.agent.post(`/api/messages/send/${groupId}`).send({ message: "members only" });
        await notCarol;
    });

    test("a user who reconnects rejoins their group rooms", async () => {
        const group = await alice.agent
            .post("/api/groups/create")
            .send({ name: "Rejoin group", participants: [carol.user._id] });

        const { body } = await carol.agent.get("/api/auth/socket-token");
        const second = open(body.token);
        await nextEvent(second, "connect");
        // Give the server a moment to run the group-room query
        await new Promise((resolve) => setTimeout(resolve, 200));

        const received = nextEvent(second, "newMessage");
        await alice.agent.post(`/api/messages/send/${group.body._id}`).send({ message: "welcome back" });
        expect(await received).toMatchObject({ message: "welcome back" });
    });

    test("going offline is broadcast once the last tab closes", async () => {
        const erin = await onlineUser();
        const { body } = await erin.agent.get("/api/auth/socket-token");
        const secondTab = open(body.token);
        await nextEvent(secondTab, "connect");
        // Let the broadcast for the second tab arrive first
        await new Promise((resolve) => setTimeout(resolve, 200));

        // One tab closed: still online
        const stillOnline = eventMatching(alice.socket, "getOnlineUsers", (ids) => ids.length > 0);
        erin.socket.disconnect();
        expect(await stillOnline).toContain(erin.user._id);

        const offline = eventMatching(alice.socket, "getOnlineUsers", (ids) => !ids.includes(erin.user._id));
        secondTab.disconnect();
        await offline;
    });
});
