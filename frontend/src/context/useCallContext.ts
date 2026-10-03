import { createContext, useContext, type RefObject } from "react";
import type { CallType } from "../types";

// Who the call is with. The caller fills userToCall; the callee gets the rest
// from the incomingCall event.
export interface CallState {
    isReceivingCall?: boolean;
    from?: string;
    name?: string;
    pic?: string;
    signal?: RTCSessionDescriptionInit;
    callType?: CallType;
    userToCall?: string;
}

export interface CallContextValue {
    call: CallState;
    callAccepted: boolean;
    callEnded: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    isCalling: boolean;
    receivingCall: boolean;
    callUser: (userToCallId: string, callType?: CallType) => Promise<void>;
    answerCall: () => Promise<void>;
    leaveCall: () => void;
    rejectCall: () => void;
    localVideoRef: RefObject<HTMLVideoElement | null>;
    remoteVideoRef: RefObject<HTMLVideoElement | null>;
    isMuted: boolean;
    isVideoOff: boolean;
    remoteVideoOff: boolean;
    toggleMute: () => void;
    toggleVideo: () => void;
}

export const CallContext = createContext<CallContextValue | null>(null);

export const useCallContext = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error("useCallContext must be used inside CallContextProvider");
    return context;
};
