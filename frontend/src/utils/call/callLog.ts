import type { CallType, Message } from "../../types";

// Saves a call log message in the chat: "missed" when the call was never
// picked up, or how long it lasted. startTime is when the call was accepted.
export const sendCallLog = (
    userToCall: string,
    callType: CallType | undefined,
    startTime: number | null,
    addMessage: (message: Message) => void,
) => {
    const duration = startTime ? Date.now() - startTime : 0;
    let logText = callType === "audio" ? "Missed voice call" : "Missed video call";

    if (duration > 0) {
        const totalSeconds = Math.floor(duration / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        logText = callType === "audio" ? `Voice call ended • ${formattedTime}` : `Video call ended • ${formattedTime}`;
    }

    fetch(`/api/messages/send/${userToCall}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: logText, isCall: true }),
        credentials: "include",
    })
        .then((res) => res.json() as Promise<{ newMessage?: Message }>)
        .then((data) => {
            if (data.newMessage) {
                addMessage(data.newMessage);
            }
        })
        .catch(console.error);
};
