import type { Dispatch, RefObject, SetStateAction } from "react";
import type { AppSocket } from "../types";
import type { CallState } from "../context/useCallContext";

interface CallControlsOptions {
    socket: AppSocket | null;
    call: CallState;
    streamRef: RefObject<MediaStream | null>;
    setIsMuted: Dispatch<SetStateAction<boolean>>;
    setIsVideoOff: Dispatch<SetStateAction<boolean>>;
}

// The mute and camera buttons of a call.
const useCallControls = ({
    socket,
    call,
    streamRef,
    setIsMuted,
    setIsVideoOff,
}: CallControlsOptions) => {
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
                    socket?.emit("toggleVideo", {
                        to: call.from || call.userToCall,
                        isVideoOff: !videoTrack.enabled,
                    });
                }
            }
        }
    };

    return { toggleMute, toggleVideo };
};

export default useCallControls;
