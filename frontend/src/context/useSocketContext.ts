import { createContext, useContext } from "react";
import type { AppSocket } from "../types";

interface SocketContextValue {
	socket: AppSocket | null;
	onlineUsers: string[];
}

export const SocketContext = createContext<SocketContextValue | null>(null);

export const useSocketContext = () => {
	const context = useContext(SocketContext);
	if (!context) throw new Error("useSocketContext must be used inside SocketContextProvider");
	return context;
};
