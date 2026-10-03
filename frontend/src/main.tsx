import React from "react";
import ReactDOM from "react-dom/client";
import ThemeWrapper from "./ThemeWrapper";
import "@fontsource-variable/geist";
import "@fontsource/instrument-serif";
import "@fontsource/instrument-serif/400-italic.css";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./index.css";
import { BrowserRouter } from "react-router";
import { AuthContextProvider } from "./context/AuthContext";
import { SocketContextProvider } from "./context/SocketContext";
import { MotionConfig, LazyMotion, domAnimation } from "motion/react";
import { registerServiceWorker } from "./utils/push";

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
