import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { useAuthContext } from "../context/AuthContext";

const useSignup = () => {
    const [loading, setLoading] = useState(false);
    const { setAuthUser } = useAuthContext();

    const signup = async ({
        fullName,
        username,
        password,
        confirmPassword,
    }) => {
        const success = handleInputErrors({
            fullName,
            username,
            password,
            confirmPassword,
        });
        if (!success) return;

        setLoading(true);
        try {
            const res = await fetch(
                `/api/auth/signup`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        fullName,
                        username,
                        password,
                        confirmPassword,
                    }),
                },
            );

            const data = await res.json();
            if (data.error) {
                throw new Error(data.error);
            }
            localStorage.setItem("chat-user", JSON.stringify(data));
            setAuthUser(data);
        } catch (error) {
            notifications.show({ message: error.message, color: "red" });
        } finally {
            setLoading(false);
        }
    };

    return { loading, signup };
};
export default useSignup;

function handleInputErrors({ fullName, username, password, confirmPassword }) {
    if (!fullName || !username || !password || !confirmPassword) {
        notifications.show({ message: "Please fill in all fields", color: "red" });
        return false;
    }

    if (password !== confirmPassword) {
        notifications.show({ message: "Passwords do not match", color: "red" });
        return false;
    }

    if (password.length < 6) {
        notifications.show({ message: "Password must be at least 6 characters", color: "red" });
        return false;
    }

    return true;
}
