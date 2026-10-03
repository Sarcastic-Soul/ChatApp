import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { useAuthContext } from "../context/useAuthContext";
import useConversation from "../zustand/useConversation";
import { errorMessage } from "../utils/errorMessage";
import type { ApiError, Message, Reaction } from "../types";

// Adds or removes the user's reaction on a message
const useReactToMessage = (message: Message) => {
    const { authUser } = useAuthContext();
    const updateMessage = useConversation((state) => state.updateMessage);
    const [isReacting, setIsReacting] = useState(false);
    // The reaction that was just picked, so its pill can pop once
    const [animating, setAnimating] = useState<string | null>(null);

    const hasReacted = (emoji: string) =>
        message.reactions?.some((r) => r.userId === authUser?._id && r.reaction === emoji);

    const react = async (reaction: string) => {
        if (isReacting) return;
        setIsReacting(true);
        setAnimating(reaction);

        try {
            const res = await fetch(`/api/messages/react/${message._id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reaction }),
            });
            const data = (await res.json()) as { reactions: Reaction[] } & ApiError;
            if (data.error) throw new Error(data.error);

            updateMessage({ ...message, reactions: data.reactions });
            setTimeout(() => setAnimating(null), 400);
        } catch (error) {
            notifications.show({ message: errorMessage(error), color: "red" });
            setAnimating(null);
        } finally {
            setIsReacting(false);
        }
    };

    return { react, hasReacted, animating };
};

export default useReactToMessage;
