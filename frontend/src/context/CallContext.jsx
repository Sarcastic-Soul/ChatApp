import React, {
    createContext,
    useContext,
    useState,
    useRef,
    useEffect,
} from "react";
import { useSocketContext } from "./SocketContext";
import { useAuthContext } from "./AuthContext";
import useConversation from "../zustand/useConversation";
import { notifications } from "@mantine/notifications";

export const CallContext = createContext();

export const useCallContext = () => {
    return useContext(CallContext);
};

export const CallContextProvider = ({ children }) => {
    const { socket } = useSocketContext();
    const { authUser } = useAuthContext();
    const { addMessage } = useConversation();

    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [call, setCall] = useState({});
    const [callAccepted, setCallAccepted] = useState(false);
    const [callEnded, setCallEnded] = useState(false);
    const [isCalling, setIsCalling] = useState(false);
    const [receivingCall, setReceivingCall] = useState(false);

    // Call Controls State
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [remoteVideoOff, setRemoteVideoOff] = useState(false);

    const connectionRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const streamRef = useRef(null);
    const pendingCandidates = useRef([]);
    const callStartTimeRef = useRef(null);
    const endCallCleanupRef = useRef();

    const configuration = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
        ],
    };

    useEffect(() => {
        const handleBeforeUnload = () => {
            if (connectionRef.current) {
                socket?.emit("endCall", { to: call.from || call.userToCall });
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () =>
            window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [socket, call]);

    useEffect(() => {
        if (!socket) return;

        socket.on("incomingCall", ({ from, callerName, callerPic, signal, callType }) => {
            setCall({
                isReceivingCall: true,
                from,
                name: callerName,
                pic: callerPic,
                signal,
                callType,
            });
            setReceivingCall(true);
            setCallEnded(false);
        });

        socket.on("callEnded", () => {
            if (endCallCleanupRef.current) endCallCleanupRef.current();
        });

        socket.on("callAccepted", async (signal) => {
            setCallAccepted(true);
            callStartTimeRef.current = Date.now();
            if (
                connectionRef.current &&
                connectionRef.current.signalingState !== "closed"
            ) {
                try {
                    await connectionRef.current.setRemoteDescription(
                        new RTCSessionDescription(signal),
                    );
                    pendingCandidates.current.forEach((c) => {
                        connectionRef.current
                            .addIceCandidate(new RTCIceCandidate(c))
                            .catch(console.error);
                    });
                    pendingCandidates.current = [];
                } catch (error) {
                    console.error("Error setting remote description:", error);
                }
            }
        });

        socket.on("iceCandidate", (candidate) => {
            if (
                connectionRef.current &&
                connectionRef.current.remoteDescription &&
                connectionRef.current.signalingState !== "closed"
            ) {
                connectionRef.current
                    .addIceCandidate(new RTCIceCandidate(candidate))
                    .catch(console.error);
            } else {
                pendingCandidates.current.push(candidate);
            }
        });

        socket.on("peerVideoToggled", (isVideoOff) => {
            setRemoteVideoOff(isVideoOff);
        });

        return () => {
            socket.off("incomingCall");
            socket.off("callEnded");
            socket.off("callAccepted");
            socket.off("iceCandidate");
            socket.off("peerVideoToggled");
        };
    }, [socket]);

    
    useEffect(() => {
        endCallCleanupRef.current = endCallCleanup;
    });

    const endCallCleanup = () => {
        // Send Call Log if caller
        if (isCalling && call.userToCall) {
            const duration = callStartTimeRef.current ? Date.now() - callStartTimeRef.current : 0;
            let logText = call.callType === "audio" ? "Missed voice call" : "Missed video call";
            
            if (duration > 0) {
                const totalSeconds = Math.floor(duration / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                logText = call.callType === "audio" ? `Voice call ended • ${formattedTime}` : `Video call ended • ${formattedTime}`;
            }

            fetch(`/api/messages/send/${call.userToCall}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: logText, isCall: true }),
                credentials: "include"
            })
            .then(res => res.json())
            .then(data => {
                if (data.newMessage) {
                    addMessage(data.newMessage);
                }
            })
            .catch(console.error);
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

    const setupMedia = async (isVideo = true) => {
        setIsVideoOff(!isVideo);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: isVideo,
                audio: true,
            });
            setLocalStream(stream);
            streamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            return stream;
        } catch (error) {
            console.error("Failed to access media devices with video:", error);

            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: true,
                });
                setLocalStream(audioStream);
                streamRef.current = audioStream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = audioStream;
                }
                notifications.show({
                    title: "Camera Unavailable",
                    message: "Proceeding with audio only.",
                    color: "yellow",
                });
                setIsVideoOff(true);
                return audioStream;
            } catch (audioError) {
                console.error("Failed to access any media devices:", audioError);
                notifications.show({
                    title: "Hardware Error",
                    message: "Could not access camera or microphone.",
                    color: "red",
                });
                return null;
            }
        }
    };

    const callUser = async (userToCallId, callType = "video") => {
        const isVideo = callType === "video";
        const stream = await setupMedia(isVideo);
        if (!stream) return;

        setIsCalling(true);
        setCallEnded(false);
        const peer = new RTCPeerConnection(configuration);
        connectionRef.current = peer;

        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        peer.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("iceCandidate", {
                    to: userToCallId,
                    candidate: event.candidate,
                });
            }
        };

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        setCall({ isReceivingCall: false, userToCall: userToCallId, callType });

        socket.emit("callUser", {
            userToCall: userToCallId,
            signalData: offer,
            from: authUser._id,
            callerName: authUser.fullName,
            callerPic: authUser.profilePic,
            callType,
        });
    };

    const answerCall = async () => {
        setCallAccepted(true);
        const stream = await setupMedia();
        if (!stream) return;

        const peer = new RTCPeerConnection(configuration);
        connectionRef.current = peer;

        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        peer.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("iceCandidate", {
                    to: call.from,
                    candidate: event.candidate,
                });
            }
        };

        await peer.setRemoteDescription(new RTCSessionDescription(call.signal));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        pendingCandidates.current.forEach((c) => {
            peer.addIceCandidate(new RTCIceCandidate(c)).catch(console.error);
        });
        pendingCandidates.current = [];

        socket.emit("answerCall", { signal: answer, to: call.from });
    };

    const leaveCall = () => {
        if (call.from || call.userToCall) {
            socket.emit("endCall", { to: call.from || call.userToCall });
        }
        endCallCleanup();
    };

    const rejectCall = () => {
        if (call.from) {
            socket.emit("endCall", { to: call.from });
        }
        endCallCleanup();
    };

    // Toggle Audio
    const toggleMute = () => {
        if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    // Toggle Video
    const toggleVideo = () => {
        if (streamRef.current) {
            const videoTrack = streamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
                
                // Notify the other peer
                if (call.from || call.userToCall) {
                    socket.emit("toggleVideo", { 
                        to: call.from || call.userToCall, 
                        isVideoOff: !videoTrack.enabled 
                    });
                }
            }
        }
    };

    return (
        <CallContext.Provider
            value={{
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
                toggleVideo
            }}
        >
            {children}
        </CallContext.Provider>
    );
};
