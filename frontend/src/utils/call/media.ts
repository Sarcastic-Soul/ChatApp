import { notifications } from "@mantine/notifications";

// Asks for the microphone, and the camera for a video call. When the camera
// can't be used it falls back to audio only and says so with cameraFailed.
// Gives back null when nothing could be opened.
export const openCallMedia = async (
    isVideo: boolean,
): Promise<{ stream: MediaStream; cameraFailed: boolean } | null> => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: isVideo,
            audio: true,
        });
        return { stream, cameraFailed: false };
    } catch (error) {
        console.error("Failed to access media devices with video:", error);

        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true,
            });
            notifications.show({
                title: "Camera Unavailable",
                message: "Proceeding with audio only.",
                color: "yellow",
            });
            return { stream: audioStream, cameraFailed: true };
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
