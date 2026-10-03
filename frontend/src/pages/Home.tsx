import { useState, useEffect, type MouseEvent as ReactMouseEvent } from "react";
import MessageContainer from "../components/messages/MessageContainer";
import Sidebar from "../components/sidebar/Sidebar";
import { Flex, Box } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import useConversation from "../zustand/useConversation";
import useNotificationChat from "../hooks/useNotificationChat";
import useDelivery from "../hooks/useDelivery";
import useListenMessages from "../hooks/useListenMessages";

const MIN_SIDEBAR = 260;

const Home = () => {
    const { selectedConversation } = useConversation();
    const isMobile = useMediaQuery("(max-width: 768px)");
    useNotificationChat();
    useDelivery();
    // Here rather than in the open chat, so the chat list stays live too
    useListenMessages();

    // Start at a quarter of the window, kept between 280px and 400px
    const [sidebarWidth, setSidebarWidth] = useState(() =>
        Math.min(400, Math.max(280, window.innerWidth * 0.25)),
    );

    useEffect(() => {
        const handleResize = () => {
            // Keep the sidebar under half the window when the window shrinks
            setSidebarWidth((prev) =>
                Math.max(MIN_SIDEBAR, Math.min(prev, window.innerWidth * 0.5)),
            );
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const handleMouseDown = (e: ReactMouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = sidebarWidth;

        const onMouseMove = (mousemoveEvent: MouseEvent) => {
            const newWidth = Math.max(
                MIN_SIDEBAR,
                Math.min(
                    window.innerWidth * 0.5,
                    startWidth + (mousemoveEvent.clientX - startX),
                ),
            );
            setSidebarWidth(newWidth);
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    return (
        <Flex h="100dvh" w="100%" style={{ overflow: "hidden" }}>
            {(!isMobile || !selectedConversation) && (
                <Box
                    w={isMobile ? "100%" : sidebarWidth}
                    style={{
                        flexShrink: 0,
                        height: "100%",
                        backgroundColor: "var(--mantine-color-body)",
                    }}
                >
                    <Sidebar />
                </Box>
            )}

            {!isMobile && (
                <div
                    className="resize-handle"
                    onMouseDown={handleMouseDown}
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Resize sidebar"
                />
            )}

            {(!isMobile || selectedConversation) && (
                <Box
                    component="main"
                    style={{
                        flex: 1,
                        minWidth: 0,
                        height: "100%",
                        backgroundColor: "var(--surface)",
                    }}
                >
                    <MessageContainer />
                </Box>
            )}
        </Flex>
    );
};

export default Home;
