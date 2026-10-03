import { useState, useRef, useEffect } from "react";
import { useSocketContext } from "../context/useSocketContext";
import { useAuthContext } from "../context/useAuthContext";
import type { CallContextValue, CallState } from "../context/useCallContext";
import useConversation from "../zustand/useConversation";
import useIceServers from "./useIceServers";
import useCallSignaling from "./useCallSignaling";
import useCallControls from "./useCallControls";
import { openCallMedia } from "../utils/call/media";
import { createPeer } from "../utils/call/peer";
import { sendCallLog } from "../utils/call/callLog";
import type { CallType } from "../types";

// Holds the state of the current voice or video call and the actions to
// start, answer and end it.
const useCallSession = (): CallContextValue => {
    const { socket } = useSocketContext();
    const { authUser } = useAuthContext();
    const { addMessage } = useConversation();

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [call, setCall] = useState<CallState>({});
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [isCalling, setIsCalling] = useState(false);
    const [receivingCall, setReceivingCall] = useState(false);

    // Call Controls State
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [remoteVideoOff, setRemoteVideoOff] = useState(false);

    const connectionRef = useRef<RTCPeerConnection | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
    const callStartTimeRef = useRef<number | null>(null);
    const endCallCleanupRef = useRef<(() => void) | null>(null);

    const getConfiguration = useIceServers(authUser);

    useCallSignaling({
        socket,
        call,
        connectionRef,
        pendingCandidates,
        callStartTimeRef,
        endCallCleanupRef,
        setCall,
        setReceivingCall,
        setCallEnded,
        setCallAccepted,
        setRemoteVideoOff,
    });

    const endCallCleanup = () => {
        // Send Call Log if caller
        if (isCalling && call.userToCall) {
            sendCallLog(call.userToCall, call.callType, callStartTimeRef.current, addMessage);
        }

        callStartTimeRef.current = null;
        setCallEnded(false);

        setCallAccepted(false);
        setIsCalling(false);
        setReceivingCall(false);
        setCall({});
        pendingCandidates.current = [];

        setIsMuted(false);
        setIsVideoOff(false);
        setRemoteVideoOff(false);

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (connectionRef.current) {
            connectionRef.current.close();
            connectionRef.current = null;
        }

        setLocalStream(null);
        setRemoteStream(null);
    };

    // The socket listeners are set up once, so they reach the newest
    // cleanup function through this ref.
    useEffect(() => {
        endCallCleanupRef.current = endCallCleanup;
    });

    const setupMedia = async (isVideo = true) => {
        setIsVideoOff(!isVideo);
        const media = await openCallMedia(isVideo);
        if (!media) return null;

        setLocalStream(media.stream);
        streamRef.current = media.stream;
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = media.stream;
        }
        if (media.cameraFailed) setIsVideoOff(true);
        return media.stream;
    };

    // Builds the peer connection for a call with the given user
    const connectPeer = async (stream: MediaStream, otherUserId: string) => {
        const peer = createPeer({
            configuration: await getConfiguration(),
            stream,
            onRemoteStream: (remote) => {
                setRemoteStream(remote);
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remote;
                }
            },
            onIceCandidate: (candidate) => {
                socket?.emit("iceCandidate", { to: otherUserId, candidate });
            },
        });
        connectionRef.current = peer;
        return peer;
    };

    const callUser = async (userToCallId: string, callType: CallType = "video") => {
        const isVideo = callType === "video";
        const stream = await setupMedia(isVideo);
        if (!stream) return;

        setIsCalling(true);
        setCallEnded(false);
        const peer = await connectPeer(stream, userToCallId);

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        setCall({ isReceivingCall: false, userToCall: userToCallId, callType });

        socket?.emit("callUser", {
            userToCall: userToCallId,
            signalData: offer,
            from: authUser?._id,
            callerName: authUser?.fullName,
            callerPic: authUser?.profilePic,
            callType,
        });
    };

    const answerCall = async () => {
        const { signal, from } = call;
        if (!signal || !from) return;
        setCallAccepted(true);
        const stream = await setupMedia();
        if (!stream) return;

        const peer = await connectPeer(stream, from);

        await peer.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        pendingCandidates.current.forEach((c) => {
            peer.addIceCandidate(new RTCIceCandidate(c)).catch(console.error);
        });
        pendingCandidates.current = [];

        socket?.emit("answerCall", { signal: answer, to: from });
    };

    const leaveCall = () => {
        if (call.from || call.userToCall) {
            socket?.emit("endCall", { to: call.from || call.userToCall });
        }
        endCallCleanup();
    };

    const rejectCall = () => {
        if (call.from) {
            socket?.emit("endCall", { to: call.from });
        }
        endCallCleanup();
    };

    const { toggleMute, toggleVideo } = useCallControls({
        socket,
        call,
        streamRef,
        setIsMuted,
        setIsVideoOff,
    });

    return {
        call,
        callAccepted,
        callEnded,
        localStream,
        remoteStream,
        isCalling,
        receivingCall,
        callUser,
        answerCall,
        leaveCall,
        rejectCall,
        localVideoRef,
        remoteVideoRef,
        isMuted,
        isVideoOff,
        remoteVideoOff,
        toggleMute,
        toggleVideo,
    };
};

export default useCallSession;
