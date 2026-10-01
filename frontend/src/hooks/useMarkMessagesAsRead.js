import { useCallback } from "react";
const useMarkMessagesAsRead = () => {
    const markAsRead = useCallback(async (conversationId) => {
        try {
            const res = await fetch(
                `/api/messages/read/${conversationId}`,
                {
                    method: "POST",
                    credentials: "include",
                },
            );
            if (res.ok) {
                // Assuming backend handles marking and emitting
            }
        } catch (error) {
            console.error("Error marking messages as read:", error);
        }
    }, []);

    return { markAsRead };
};

export default useMarkMessagesAsRead;
