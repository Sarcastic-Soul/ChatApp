import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";
import { allowedOrigins } from "../config/allowedOrigins.js";

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST"],
    },
});

export const getReceiverSocketId = (receiverId) => {
    return userSocketMap[receiverId];
};

const userSocketMap = {};

io.on("connection", (socket) => {
    console.log("a user connected", socket.id);

    const userId = socket.handshake.query.userId;
    if (userId != "undefined") userSocketMap[userId] = socket.id;

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    // WebRTC Signaling Events
    socket.on("callUser", ({ userToCall, signalData, from, callerName, callerPic, callType }) => {
        const receiverSocketId = getReceiverSocketId(userToCall);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("incomingCall", {
                signal: signalData,
                from,
                callerName,
                callerPic,
                callType,
            });
        }
    });

    socket.on("answerCall", (data) => {
        const receiverSocketId = getReceiverSocketId(data.to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("callAccepted", data.signal);
        }
    });

    socket.on("endCall", (data) => {
        const receiverSocketId = getReceiverSocketId(data.to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("callEnded");
        }
    });

    socket.on("iceCandidate", (data) => {
        const receiverSocketId = getReceiverSocketId(data.to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("iceCandidate", data.candidate);
        }
    });

    // New event for video toggling
    socket.on("toggleVideo", (data) => {
        const receiverSocketId = getReceiverSocketId(data.to);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("peerVideoToggled", data.isVideoOff);
        }
    });

    // Typing Indicators
    socket.on("typing", (data) => {
        const { receiverId } = data;
        const receiverSocketId = getReceiverSocketId(receiverId);

        // If it's a group, receiverId will be the conversation/group ID.
        // We can just broadcast to the room.
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("typing", data);
        } else {
            // Group chat broadcast
            socket.to(receiverId).emit("typing", data);
        }
    });

    socket.on("stopTyping", (data) => {
        const { receiverId } = data;
        const receiverSocketId = getReceiverSocketId(receiverId);

        if (receiverSocketId) {
            io.to(receiverSocketId).emit("stopTyping", data);
        } else {
            socket.to(receiverId).emit("stopTyping", data);
        }
    });

    // Join Group Room
    socket.on("joinGroup", (groupId) => {
        socket.join(groupId);
    });

    socket.on("leaveGroup", (groupId) => {
        socket.leave(groupId);
    });

    socket.on("disconnect", () => {
        console.log("user disconnected", socket.id);
        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
});

export { app, io, server };
