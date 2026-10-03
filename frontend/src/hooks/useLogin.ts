import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { useAuthContext } from "../context/useAuthContext";
import { errorMessage } from "../utils/errorMessage";
import type { ApiError, AuthUser } from "../types";

const useLogin = () => {
    const [loading, setLoading] = useState(false);
    const { setAuthUser } = useAuthContext();

    const login = async (username: string, password: string) => {
        const success = handleInputErrors(username, password);
        if (!success) return;
        setLoading(true);
        try {
            const res = await fetch(
                `/api/auth/login`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ username, password }),
                },
            );

            const data = (await res.json()) as AuthUser & ApiError;
            if (data.error) {
                throw new Error(data.error);
            }

            localStorage.setItem("chat-user", JSON.stringify(data));
            setAuthUser(data);
        } catch (error) {
            notifications.show({ message: errorMessage(error), color: "red" });
        } finally {
            setLoading(false);
        }
    };

    return { loading, login };
};
export default useLogin;

function handleInputErrors(username: string, password: string) {
    if (!username || !password) {
        notifications.show({ message: "Please fill in all fields", color: "red" });
        return false;
    }

    return true;
}
