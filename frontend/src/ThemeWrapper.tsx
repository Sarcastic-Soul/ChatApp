import { useMemo } from "react";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import App from "./App";
import { CallContextProvider } from "./context/CallContext";
import useThemeStore from "./zustand/useThemeStore";
import { buildTheme, cssVariablesResolver } from "./theme";

// The app inside the theme, rebuilt when the accent color changes
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

export default ThemeWrapper;
