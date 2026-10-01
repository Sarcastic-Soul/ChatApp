import { createContext, useState, useEffect, useContext } from "react";
import { useAuthContext } from "./AuthContext";
import io from "socket.io-client";

const SocketContext = createContext();

export const useSocketContext = () => {
	return useContext(SocketContext);
};

// The socket server runs on the backend's own domain, so it can't read the
// auth cookie. Each (re)connect fetches a short-lived token instead.
const fetchSocketToken = async (cb) => {
	try {
		const res = await fetch("/api/auth/socket-token");
		const data = await res.json();
		cb({ token: data.token });
	} catch {
		cb({ token: null });
	}
};

export const SocketContextProvider = ({ children }) => {
	const [socket, setSocket] = useState(null);
	const [onlineUsers, setOnlineUsers] = useState([]);
	const { authUser } = useAuthContext();
	const userId = authUser?._id;

	useEffect(() => {
		if (!userId) return;

		const newSocket = io(import.meta.env.VITE_API_URL, {
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
