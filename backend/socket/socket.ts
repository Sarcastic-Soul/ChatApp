import { Server, type DefaultEventsMap } from "socket.io";
import http from "http";
import express from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Types } from "mongoose";
import type { z } from "zod";
import Conversation from "../models/conversation.model.ts";
import { allowedOrigins } from "../config/allowedOrigins.ts";
import { socketEvents, type SocketEventName } from "../validation/socketEvents.ts";
import { requireEnv } from "../config/env.ts";
import { errorMessage } from "../utils/errorMessage.ts";

type Id = Types.ObjectId | string;

// Set by the auth middleware below for every connected socket
type SocketData = { userId: string };

const app = express();

const server = http.createServer(app);
const io = new Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
});

// userId -> number of open sockets (a user can have several tabs open)
const onlineUsers = new Map<string, number>();

// Every socket joins a room named after its user id, so emitting to that
// room reaches all of the user's tabs. Returns the room name when the user
// is online, undefined otherwise.
export const getReceiverSocketId = (receiverId: Id | null | undefined) => {
    const id = receiverId?.toString();
    return id && onlineUsers.has(id) ? id : undefined;
};

export const addUserToRoom = (userId: Id, room: Id) => {
    io.in(userId.toString()).socketsJoin(room.toString());
};

export const removeUserFromRoom = (userId: Id, room: Id) => {
    io.in(userId.toString()).socketsLeave(room.toString());
};

const emitOnlineUsers = () => {
    io.emit("getOnlineUsers", [...onlineUsers.keys()]);
};

// Sockets authenticate with a short-lived token from GET /api/auth/socket-token
io.use((socket, next) => {
    try {
        const { token } = socket.handshake.auth || {};
        const decoded = jwt.verify(token, requireEnv("JWT_SECRET")) as JwtPayload;
        if (decoded.scope !== "socket") throw new Error("Wrong token scope");
        socket.data.userId = decoded.userId.toString();
        next();
    } catch {
        next(new Error("Unauthorized"));
    }
});

io.on("connection", async (socket) => {
    const { userId } = socket.data;

    socket.join(userId);
    onlineUsers.set(userId, (onlineUsers.get(userId) || 0) + 1);
    emitOnlineUsers();

    // Sends to a user's room, or to a group room this socket belongs to
    const relay = (targetId: Id | null | undefined, event: string, payload?: unknown) => {
        const target = targetId?.toString();
        if (!target) return;
        if (onlineUsers.has(target)) {
            io.to(target).emit(event, payload);
        } else if (socket.rooms.has(target)) {
            socket.to(target).emit(event, payload);
        }
    };

    // Listens for a client event and drops any payload that does not match
    // its schema, so a bad payload can't throw inside a handler
    const on = <E extends SocketEventName>(
        event: E,
        handler: (data: z.output<(typeof socketEvents)[E]>) => void,
    ) => {
        socket.on(event as string, (payload: unknown) => {
            const result = socketEvents[event].safeParse(payload);
            if (result.success) handler(result.data as z.output<(typeof socketEvents)[E]>);
        });
    };

    // WebRTC Signaling Events
    on("callUser", ({ userToCall, signalData, callerName, callerPic, callType }) => {
        relay(userToCall, "incomingCall", {
            signal: signalData,
            from: userId,
            callerName,
            callerPic,
            callType,
        });
    });

    on("answerCall", ({ to, signal }) => relay(to, "callAccepted", signal));
    on("endCall", ({ to }) => relay(to, "callEnded"));
    on("iceCandidate", ({ to, candidate }) => relay(to, "iceCandidate", candidate));
    on("toggleVideo", ({ to, isVideoOff }) => relay(to, "peerVideoToggled", isVideoOff));

    // Typing Indicators. receiverId is the other user in a 1-on-1 chat; in a
    // group the event goes to the group room.
    const relayTyping = (
        event: "typing" | "stopTyping",
        data: z.output<(typeof socketEvents)["typing"]>,
    ) => {
        const target = data.isGroupChat ? data.conversationId : data.receiverId;
        relay(target, event, { conversationId: data.conversationId, userId });
    };

    on("typing", (data) => relayTyping("typing", data));
    on("stopTyping", (data) => relayTyping("stopTyping", data));

    on("joinGroup", async (groupId) => {
        try {
            const isMember = await Conversation.exists({
                _id: groupId,
                participants: userId,
            });
            if (isMember) socket.join(groupId);
        } catch (error) {
            console.error("Error joining group room:", errorMessage(error));
        }
    });

    on("leaveGroup", (groupId) => socket.leave(groupId));

    socket.on("disconnect", () => {
        const count = (onlineUsers.get(userId) || 1) - 1;
        if (count > 0) onlineUsers.set(userId, count);
        else onlineUsers.delete(userId);
        emitOnlineUsers();
    });

    // Join group rooms last, so the handlers above are already listening
    // while this query runs
    try {
        const groups = await Conversation.find(
            { participants: userId, isGroupChat: true },
            "_id",
        ).lean();
        groups.forEach((group) => socket.join(group._id.toString()));
    } catch (error) {
        console.error("Error joining group rooms:", errorMessage(error));
    }
});

export { app, io, server };
