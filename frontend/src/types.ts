// What the backend sends, over REST and the socket. Ids arrive as strings
// and dates as ISO strings.

import type { Socket } from "socket.io-client";

// The profile fields the server shares about a user. Login, sign-up and
// /api/auth/me return exactly these for the logged-in user.
export interface PublicUser {
    _id: string;
    fullName: string;
    username: string;
    profilePic: string;
    isPublic: boolean;
}

export type AuthUser = PublicUser;

// A full user record, from /api/users and /api/users/:username
export interface User extends PublicUser {
    createdAt: string;
    updatedAt: string;
}

// A group member as the group details page loads it
export type GroupMember = Pick<PublicUser, "_id" | "fullName" | "username" | "profilePic">;

// One entry of GET /api/users/conversations. A one-on-one chat carries the
// other person's profile and a group its name and members, so most fields
// only exist for one kind. A chat opened from "New chat" has no messages
// yet and uses the other person's id as its _id until the first message.
export interface Conversation {
    _id: string;
    isGroupChat: boolean;
    profilePic?: string;
    updatedAt?: string;
    // One-on-one chats
    participantId?: string;
    fullName?: string;
    username?: string;
    isPublic?: boolean;
    // Groups
    groupName?: string;
    groupIcon?: string;
    participants?: PublicUser[];
    admins?: string[];
}

// GET /api/groups/:groupId
export interface GroupDetails {
    _id: string;
    isGroupChat: true;
    groupName: string;
    groupIcon: string;
    // Set on this page after the photo changes
    profilePic?: string;
    participants: GroupMember[];
    admins: Pick<PublicUser, "_id" | "fullName">[];
}

export type MediaType = "text" | "image" | "video" | "audio" | "file";

export interface Reaction {
    userId: string;
    reaction: string;
}

// The message a reply quotes
export interface QuotedMessage {
    _id: string;
    message: string;
    mediaType: MediaType;
    mediaUrl: string | null;
    senderId: string;
}

export interface Message {
    _id: string;
    // The sender's profile on messages sent or changed live, only the id on
    // messages loaded from history
    senderId: string | PublicUser;
    // The conversation id
    receiverId: string;
    message: string;
    mediaUrl: string | null;
    mediaType: MediaType;
    status: "sent" | "read";
    isEdited: boolean;
    isDeleted: boolean;
    isCall: boolean;
    isForwarded: boolean;
    isSystem: boolean;
    replyTo: QuotedMessage | null;
    reactions: Reaction[];
    createdAt: string;
    updatedAt: string;
    // Set in the browser, so a message that just arrived shakes once
    shouldShake?: boolean;
}

// GET /api/messages/search
export interface SearchResult {
    _id: string;
    conversationId: string;
    message: string;
    createdAt: string;
    sender: GroupMember | null;
}

// Every error response looks like this
export interface ApiError {
    error?: string;
}

export type CallType = "audio" | "video";

export interface TypingEvent {
    conversationId: string;
    userId: string;
}

interface TypingPayload {
    conversationId: string;
    receiverId?: string;
    isGroupChat: boolean;
}

export interface ServerToClientEvents {
    getOnlineUsers: (userIds: string[]) => void;
    newMessage: (message: Message) => void;
    messageReaction: (message: Message) => void;
    messageEdited: (message: Message) => void;
    messageDeleted: (message: Message) => void;
    messagesRead: (data: { conversationId: string; userId: string }) => void;
    typing: (data: TypingEvent) => void;
    stopTyping: (data: TypingEvent) => void;
    incomingCall: (data: {
        from: string;
        callerName: string;
        callerPic: string;
        signal: RTCSessionDescriptionInit;
        callType: CallType;
    }) => void;
    callAccepted: (signal: RTCSessionDescriptionInit) => void;
    callEnded: () => void;
    iceCandidate: (candidate: RTCIceCandidateInit) => void;
    peerVideoToggled: (isVideoOff: boolean) => void;
}

// The server checks each payload against backend/validation/socketEvents.ts
// and drops it if `to` is missing
export interface ClientToServerEvents {
    callUser: (data: {
        userToCall: string;
        signalData: RTCSessionDescriptionInit;
        from?: string;
        callerName?: string;
        callerPic?: string;
        callType: CallType;
    }) => void;
    answerCall: (data: { to?: string; signal: RTCSessionDescriptionInit }) => void;
    endCall: (data: { to?: string }) => void;
    iceCandidate: (data: { to?: string; candidate: RTCIceCandidateInit }) => void;
    toggleVideo: (data: { to?: string; isVideoOff: boolean }) => void;
    typing: (data: TypingPayload) => void;
    stopTyping: (data: TypingPayload) => void;
    joinGroup: (groupId: string) => void;
    leaveGroup: (groupId: string) => void;
}

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
