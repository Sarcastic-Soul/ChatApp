import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAuthContext } from "../context/AuthContext";
import { renderWithProviders } from "../test/render";
import Login from "./Login";

const alice = { _id: "u1", fullName: "Alice", username: "alice", profilePic: "", isPublic: true };

// Shows who is logged in, so tests can see the auth state change
const WhoAmI = () => {
    const { authUser } = useAuthContext();
    return <p>logged in as: {authUser?.username ?? "nobody"}</p>;
};

const jsonResponse = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock;

beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
    vi.restoreAllMocks();
});

const renderLogin = () =>
    renderWithProviders(
        <>
            <Login />
            <WhoAmI />
        </>,
        { route: "/login" },
    );

describe("Login page", () => {
    test("logs in with the typed username and password", async () => {
        fetchMock.mockResolvedValue(jsonResponse(alice));
        const user = userEvent.setup();
        renderLogin();

        await user.type(screen.getByLabelText(/username/i), "alice");
        await user.type(screen.getByLabelText(/^password/i), "password123");
        await user.click(screen.getByRole("button", { name: "Log in" }));

        await screen.findByText("logged in as: alice");
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe("/api/auth/login");
        expect(options.credentials).toBe("include");
        expect(JSON.parse(options.body)).toEqual({ username: "alice", password: "password123" });
        expect(JSON.parse(localStorage.getItem("chat-user"))).toEqual(alice);
    });

    test("shows the server's error and stays logged out", async () => {
        fetchMock.mockResolvedValue(jsonResponse({ error: "Invalid username or password" }, 400));
        const user = userEvent.setup();
        renderLogin();

        await user.type(screen.getByLabelText(/username/i), "alice");
        await user.type(screen.getByLabelText(/^password/i), "wrong");
        await user.click(screen.getByRole("button", { name: "Log in" }));

        expect(await screen.findByText("Invalid username or password")).toBeInTheDocument();
        expect(screen.getByText("logged in as: nobody")).toBeInTheDocument();
        expect(localStorage.getItem("chat-user")).toBeNull();
    });

    test("the demo button logs in as alice", async () => {
        fetchMock.mockResolvedValue(jsonResponse(alice));
        const user = userEvent.setup();
        renderLogin();

        await user.click(screen.getByRole("button", { name: "Use the demo account" }));

        await screen.findByText("logged in as: alice");
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ username: "alice", password: "password123" });
    });

    test("links to the sign-up page", () => {
        renderLogin();
        expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/signup");
    });
});

describe("saved session", () => {
    test("a saved user the server rejects is logged out", async () => {
        localStorage.setItem("chat-user", JSON.stringify(alice));
        fetchMock.mockResolvedValue(jsonResponse({ error: "Unauthorized" }, 401));

        renderWithProviders(<WhoAmI />);
        expect(screen.getByText("logged in as: alice")).toBeInTheDocument();

        await screen.findByText("logged in as: nobody");
        expect(fetchMock).toHaveBeenCalledWith("/api/auth/me");
        expect(localStorage.getItem("chat-user")).toBeNull();
    });

    test("a saved user stays logged in when the server is unreachable", async () => {
        localStorage.setItem("chat-user", JSON.stringify(alice));
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

        renderWithProviders(<WhoAmI />);
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(screen.getByText("logged in as: alice")).toBeInTheDocument();
    });

    test("broken saved data is cleared", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        localStorage.setItem("chat-user", "{not json");
        renderWithProviders(<WhoAmI />);
        expect(screen.getByText("logged in as: nobody")).toBeInTheDocument();
        expect(localStorage.getItem("chat-user")).toBeNull();
    });
});
