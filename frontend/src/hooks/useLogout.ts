import { useState } from "react";
import { useAuthContext } from "../context/AuthContext";
import { notifications } from "@mantine/notifications";
import { clearAllMessages } from "../utils/messageCacheDB";
import { forgetIdentity } from "../utils/e2ee/identity";
import { forgetChatKeys } from "../utils/e2ee/chats";
import { disablePush } from "../utils/push";
import { errorMessage } from "../utils/errorMessage";

const useLogout = () => {
    const [loading, setLoading] = useState(false);
    const { setAuthUser } = useAuthContext();

    const logout = async () => {
        setLoading(true);
        try {
            // Stop notifications for this browser while still logged in
            await Promise.race([
                disablePush(),
                new Promise((resolve) => setTimeout(resolve, 3000)),
            ]).catch(() => {});

            await fetch(`/api/auth/logout`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });

            try {
                await Promise.race([
                    clearAllMessages(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('IndexedDB clear timeout')), 5000)
                    )
                ]);
            } catch (dbError) {
                console.warn('Failed to clear IndexedDB, trying alternative method:', dbError);
            }

            // This browser's private key goes too; the passphrase restores it
            forgetChatKeys();
            await forgetIdentity().catch((keyError) => console.warn("Failed to delete keys:", keyError));

            localStorage.removeItem("chat-user");
            setAuthUser(null);

        } catch (error) {
            notifications.show({ message: errorMessage(error), color: "red" });
            localStorage.removeItem("chat-user");
            setAuthUser(null);
        } finally {
            setLoading(false);
        }
    };

    return { loading, logout };
};
export default useLogout;
