import { useState, useEffect, type ReactNode } from "react";
import { useAuthContext } from "./useAuthContext";
import { SocketContext } from "./useSocketContext";
import io from "socket.io-client";
import type { AppSocket } from "../types";

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

		// The socket can only be made here, once there is a user to connect as
		// eslint-disable-next-line react-hooks/set-state-in-effect
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
