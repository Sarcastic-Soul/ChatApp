import { createContext, useContext } from "react";
import type { AuthUser } from "../types";

interface AuthContextValue {
    authUser: AuthUser | null;
    setAuthUser: (user: AuthUser | null) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuthContext = () => {
	const context = useContext(AuthContext);
	if (!context) throw new Error("useAuthContext must be used inside AuthContextProvider");
	return context;
};
