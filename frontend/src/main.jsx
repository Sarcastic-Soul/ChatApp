import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { CallContextProvider } from "./context/CallContext.jsx";
import "./index.css";
import { BrowserRouter } from "react-router";
import { AuthContextProvider } from "./context/AuthContext.jsx";
import { SocketContextProvider } from "./context/SocketContext.jsx";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import useThemeStore from "./zustand/useThemeStore.js";

const ThemeWrapper = () => {
    const primaryColor = useThemeStore((state) => state.primaryColor);

    return (
        <MantineProvider
            defaultColorScheme="auto"
            theme={{
                primaryColor: primaryColor,
                // Softening the default white/dark backgrounds slightly
                colors: {
                    dark: [
                        "#C1C2C5",
                        "#A6A7AB",
                        "#909296",
                        "#5C5F66",
                        "#373A40",
                        "#2C2E33",
                        "#25262B",
                        "#1A1B1E",
                        "#141517",
                        "#101113",
                    ],
                },
            }}
        >
            <Notifications position="top-right" zIndex={1000} />
            <CallContextProvider>
                <App />
            </CallContextProvider>
        </MantineProvider>
    );
};

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthContextProvider>
                <SocketContextProvider>
                    <ThemeWrapper />
                </SocketContextProvider>
            </AuthContextProvider>
        </BrowserRouter>
    </React.StrictMode>,
);
