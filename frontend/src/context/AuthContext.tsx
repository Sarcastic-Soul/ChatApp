import { useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "./useAuthContext";
import type { AuthUser } from "../types";

export const AuthContextProvider = ({ children }: { children: ReactNode }) => {
    // Initialize state from localStorage to keep the user logged in across sessions
	const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
        const storedUser = localStorage.getItem("chat-user");
        try {
            return storedUser ? (JSON.parse(storedUser) as AuthUser) : null;
        } catch (error) {
            console.error("Failed to parse auth user from localStorage", error);
            localStorage.removeItem("chat-user"); // Clear corrupted data
            return null;
        }
    });

    // Create a new function that wraps setAuthUser to also update localStorage
    const updateAuthUser = (user: AuthUser | null) => {
        if (user) {
            localStorage.setItem("chat-user", JSON.stringify(user));
        } else {
            // This handles logout
            localStorage.removeItem("chat-user");
        }
        setAuthUser(user);
    };

    // The saved user can outlive its cookie (expired, or set on the old API
    // domain). Check once on load and log out if the server says no.
    const hasStoredUser = Boolean(authUser);
    useEffect(() => {
        if (!hasStoredUser) return;
        fetch("/api/auth/me")
            .then(async (res) => {
                if (res.status === 401) updateAuthUser(null);
                else if (res.ok) updateAuthUser((await res.json()) as AuthUser);
            })
            .catch(() => {
                // Offline or server waking up: keep the saved user
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

	return <AuthContext.Provider value={{ authUser, setAuthUser: updateAuthUser }}>{children}</AuthContext.Provider>;
};
