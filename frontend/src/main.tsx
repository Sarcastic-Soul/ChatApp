import React, { useMemo } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CallContextProvider } from "./context/CallContext";
import "@fontsource-variable/geist";
import "@fontsource/instrument-serif";
import "@fontsource/instrument-serif/400-italic.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./index.css";
import { BrowserRouter } from "react-router";
import { AuthContextProvider } from "./context/AuthContext";
import { SocketContextProvider } from "./context/SocketContext";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { MotionConfig, LazyMotion, domAnimation } from "motion/react";
import useThemeStore from "./zustand/useThemeStore";
import { buildTheme, cssVariablesResolver } from "./theme";
import { registerServiceWorker } from "./utils/push";

const ThemeWrapper = () => {
    const primaryColor = useThemeStore((state) => state.primaryColor);
    const theme = useMemo(() => buildTheme(primaryColor), [primaryColor]);

    return (
        <MantineProvider
            defaultColorScheme="auto"
            theme={theme}
            cssVariablesResolver={cssVariablesResolver}
        >
            <Notifications position="top-right" zIndex={1000} />
            <CallContextProvider>
                <App />
            </CallContextProvider>
        </MantineProvider>
    );
};

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthContextProvider>
                <SocketContextProvider>
                    <MotionConfig reducedMotion="user">
                        <LazyMotion features={domAnimation} strict>
                            <ThemeWrapper />
                        </LazyMotion>
                    </MotionConfig>
                </SocketContextProvider>
            </AuthContextProvider>
        </BrowserRouter>
    </React.StrictMode>,
);
