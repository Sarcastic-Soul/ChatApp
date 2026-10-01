import type { ReactElement } from "react";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContextProvider } from "../context/AuthContext";
import { buildTheme } from "../theme";

// Renders a page with the same providers the app uses, minus sockets
export const renderWithProviders = (ui: ReactElement, { route = "/" }: { route?: string } = {}) =>
    render(
        <MemoryRouter initialEntries={[route]}>
            <AuthContextProvider>
                <MantineProvider theme={buildTheme()}>
                    <Notifications />
                    {ui}
                </MantineProvider>
            </AuthContextProvider>
        </MemoryRouter>,
    );
