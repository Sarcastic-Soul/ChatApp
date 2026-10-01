import { createContext, useState, useEffect, useContext, type ReactNode } from "react";
import { useAuthContext } from "./AuthContext";
import io from "socket.io-client";
import type { AppSocket } from "../types";

interface SocketContextValue {
	socket: AppSocket | null;
	onlineUsers: string[];
}

const SocketContext = createContext<SocketContextValue | null>(null);

export const useSocketContext = () => {
	const context = useContext(SocketContext);
	if (!context) throw new Error("useSocketContext must be used inside SocketContextProvider");
	return context;
};

// The socket server runs on the backend's own domain, so it can't read the
// auth cookie. Each (re)connect fetches a short-lived token instead.
const fetchSocketToken = async (cb: (data: { token: string | null }) => void) => {
	try {
		const res = await fetch("/api/auth/socket-token");
		const data = (await res.json()) as { token: string | null };
		cb({ token: data.token });
	} catch {
		cb({ token: null });
	}
};

export const SocketContextProvider = ({ children }: { children: ReactNode }) => {
	const [socket, setSocket] = useState<AppSocket | null>(null);
	const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
	const { authUser } = useAuthContext();
	const userId = authUser?._id;

	useEffect(() => {
		if (!userId) return;

		const newSocket: AppSocket = io(import.meta.env.VITE_API_URL, {
			auth: fetchSocketToken,
		});

		setSocket(newSocket);

		newSocket.on("getOnlineUsers", (users) => {
			setOnlineUsers(users);
		});

		return () => {
			newSocket.close();
			setSocket(null);
			setOnlineUsers([]);
		};
	}, [userId]);

	return <SocketContext.Provider value={{ socket, onlineUsers }}>{children}</SocketContext.Provider>;
};
