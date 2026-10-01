import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import SignUp from "./SignUp";

let fetchMock;

beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
    vi.restoreAllMocks();
});

const fill = async (user, { fullName = "Priya Raman", username = "priya", password = "secret1", confirm = password } = {}) => {
    await user.type(screen.getByLabelText(/full name/i), fullName);
    await user.type(screen.getByLabelText(/username/i), username);
    await user.type(screen.getByLabelText(/^password/i), password);
    await user.type(screen.getByLabelText(/confirm password/i), confirm);
};

describe("Sign-up page", () => {
    test("sends the form to the API", async () => {
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ _id: "u2", username: "priya" }), { status: 201 }),
        );
        const user = userEvent.setup();
        renderWithProviders(<SignUp />, { route: "/signup" });

        await fill(user);
        await user.click(screen.getByRole("button", { name: "Create account" }));

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, options] = fetchMock.mock.calls[0];
        expect(url).toBe("/api/auth/signup");
        expect(JSON.parse(options.body)).toEqual({
            fullName: "Priya Raman",
            username: "priya",
            password: "secret1",
            confirmPassword: "secret1",
        });
    });

    test("warns about a short password after leaving the field", async () => {
        const user = userEvent.setup();
        renderWithProviders(<SignUp />);

        await user.type(screen.getByLabelText(/^password/i), "123");
        await user.tab();
        expect(screen.getByText("Use at least 6 characters")).toBeInTheDocument();
    });

    test("warns when the passwords don't match", async () => {
        const user = userEvent.setup();
        renderWithProviders(<SignUp />);

        await fill(user, { password: "secret1", confirm: "secret2" });
        await user.tab();
        expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
    });

    test("blocks a username the server would reject, without calling it", async () => {
        const user = userEvent.setup();
        renderWithProviders(<SignUp />);

        await fill(user, { username: "two words" });
        await user.click(screen.getByRole("button", { name: "Create account" }));

        expect(
            await screen.findByText("Username must be 3 to 30 letters, numbers, dots or underscores"),
        ).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
