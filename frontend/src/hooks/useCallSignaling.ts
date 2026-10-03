import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { AppSocket } from "../types";
import type { CallState } from "../context/useCallContext";

interface CallSignalingOptions {
    socket: AppSocket | null;
    call: CallState;
    connectionRef: RefObject<RTCPeerConnection | null>;
    pendingCandidates: RefObject<RTCIceCandidateInit[]>;
    callStartTimeRef: RefObject<number | null>;
    endCallCleanupRef: RefObject<(() => void) | null>;
    setCall: Dispatch<SetStateAction<CallState>>;
    setReceivingCall: Dispatch<SetStateAction<boolean>>;
    setCallEnded: Dispatch<SetStateAction<boolean>>;
    setCallAccepted: Dispatch<SetStateAction<boolean>>;
    setRemoteVideoOff: Dispatch<SetStateAction<boolean>>;
}

// Listens for the call events the other person sends through the socket,
// and tells them the call is over when the page closes.
const useCallSignaling = ({
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
}: CallSignalingOptions) => {
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (connectionRef.current) {
                socket?.emit("endCall", { to: call.from || call.userToCall });
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () =>
            window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [socket, call, connectionRef]);

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
            const peer = connectionRef.current;
            if (peer && peer.signalingState !== "closed") {
                try {
                    await peer.setRemoteDescription(
                        new RTCSessionDescription(signal),
                    );
                    pendingCandidates.current.forEach((c) => {
                        peer
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
        // The refs and state setters never change, so this still runs only
        // when the socket does.
    }, [
        socket,
        connectionRef,
        pendingCandidates,
        callStartTimeRef,
        endCallCleanupRef,
        setCall,
        setReceivingCall,
        setCallEnded,
        setCallAccepted,
        setRemoteVideoOff,
    ]);
};

export default useCallSignaling;
