import { z } from "zod";
import { objectId } from "./fields.ts";

// Payload schemas for events the client sends over the socket. WebRTC
// offers, answers and ICE candidates are passed through as-is, since only
// the two browsers in the call read them.

const target = objectId("Target");
const signal = z.looseObject({});

const typing = z.object({
    conversationId: objectId("Conversation id"),
    receiverId: objectId("Receiver id").nullish(),
    isGroupChat: z.boolean().default(false),
});

export const socketEvents = {
    callUser: z.object({
        userToCall: target,
        signalData: signal,
        callerName: z.string().max(100).default(""),
        callerPic: z.string().max(2048).default(""),
        callType: z.enum(["audio", "video"]).default("video"),
    }),
    answerCall: z.object({ to: target, signal }),
    endCall: z.object({ to: target }),
    iceCandidate: z.object({ to: target, candidate: signal }),
    toggleVideo: z.object({ to: target, isVideoOff: z.boolean() }),
    typing,
    stopTyping: typing,
    joinGroup: objectId("Group id"),
    leaveGroup: objectId("Group id"),
};

export type SocketEventName = keyof typeof socketEvents;
