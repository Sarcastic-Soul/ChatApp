import { describe, expect, test } from "vitest";
import User from "../models/user.model.js";
import { api, createUser } from "./helpers.js";

const signupBody = (overrides = {}) => ({
    fullName: "Asha Rao",
    username: `asha_${Date.now()}`,
    password: "password123",
    confirmPassword: "password123",
    ...overrides,
});

const authCookie = (res) => res.headers["set-cookie"]?.find((c) => c.startsWith("jwt="));

describe("POST /api/auth/signup", () => {
    test("creates the user, hashes the password and sets the auth cookie", async () => {
        const body = signupBody();
        const res = await api().post("/api/auth/signup").send(body);

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ fullName: "Asha Rao", username: body.username, isPublic: true });
        expect(res.body).not.toHaveProperty("password");
        expect(authCookie(res)).toMatch(/HttpOnly/);

        const saved = await User.findOne({ username: body.username });
        expect(saved.password).not.toBe("password123");
        expect(saved.password).toMatch(/^\$2[aby]\$/);
    });

    test("builds the default avatar with an encoded name", async () => {
        const res = await api()
            .post("/api/auth/signup")
            .send(signupBody({ fullName: "Ana & Bo", username: `ana_${Date.now()}` }));
        expect(res.body.profilePic).toContain("name=Ana%20%26%20Bo");
    });

    test("rejects a taken username", async () => {
        const body = signupBody({ username: `taken_${Date.now()}` });
        await api().post("/api/auth/signup").send(body);
        const res = await api().post("/api/auth/signup").send(body);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Username already exists");
    });

    test.each([
        ["missing full name", { fullName: "" }, "Full name is required"],
        ["short username", { username: "ab" }, "Username must be 3 to 30 letters, numbers, dots or underscores"],
        ["username with spaces", { username: "two words" }, "Username must be 3 to 30 letters, numbers, dots or underscores"],
        ["short password", { password: "12345", confirmPassword: "12345" }, "Password must be at least 6 characters"],
        ["password over 72 characters", { password: "a".repeat(73), confirmPassword: "a".repeat(73) }, "Password must be 72 characters or fewer"],
        ["passwords that don't match", { confirmPassword: "different" }, "Passwords don't match"],
    ])("rejects %s", async (_name, overrides, error) => {
        const res = await api().post("/api/auth/signup").send(signupBody(overrides));
        expect(res.status).toBe(400);
        expect(res.body.error).toBe(error);
        expect(res.body.issues.length).toBeGreaterThan(0);
    });

    test("ignores fields that are not in the schema", async () => {
        const res = await api()
            .post("/api/auth/signup")
            .send(signupBody({ username: `extra_${Date.now()}`, isPublic: false, _id: "0123456789abcdef01234567" }));
        expect(res.status).toBe(201);
        expect(res.body.isPublic).toBe(true);
        expect(res.body._id).not.toBe("0123456789abcdef01234567");
    });
});

describe("POST /api/auth/login", () => {
    test("logs in with the right password", async () => {
        const { user } = await createUser();
        const res = await api()
            .post("/api/auth/login")
            .send({ username: user.username, password: "password123" });
        expect(res.status).toBe(200);
        expect(res.body._id).toBe(user._id);
        expect(authCookie(res)).toBeDefined();
    });

    test("gives the same error for a wrong password and an unknown user", async () => {
        const { user } = await createUser();
        const wrongPassword = await api()
            .post("/api/auth/login")
            .send({ username: user.username, password: "wrong-password" });
        const unknownUser = await api()
            .post("/api/auth/login")
            .send({ username: "nobody_here", password: "password123" });

        expect(wrongPassword.status).toBe(400);
        expect(unknownUser.status).toBe(400);
        expect(wrongPassword.body.error).toBe("Invalid username or password");
        expect(unknownUser.body.error).toBe(wrongPassword.body.error);
    });

    test("blocks NoSQL operator injection", async () => {
        const { user } = await createUser();
        const res = await api()
            .post("/api/auth/login")
            .send({ username: user.username, password: { $ne: null } });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Password is required");
    });
});

describe("session routes", () => {
    test("GET /me returns the logged-in user", async () => {
        const { agent, user } = await createUser();
        const res = await agent.get("/api/auth/me");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            _id: user._id,
            fullName: user.fullName,
            username: user.username,
            profilePic: user.profilePic,
            isPublic: true,
        });
    });

    test("GET /me without a cookie is 401", async () => {
        const res = await api().get("/api/auth/me");
        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Unauthorized - No Token Provided");
    });

    test("GET /me with a forged token is 401", async () => {
        const res = await api().get("/api/auth/me").set("Cookie", "jwt=not-a-real-token");
        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Unauthorized - Invalid Token");
    });

    test("a socket token can't be used as the auth cookie", async () => {
        const { agent } = await createUser();
        const { body } = await agent.get("/api/auth/socket-token");
        expect(body.token).toEqual(expect.any(String));

        const res = await api().get("/api/auth/me").set("Cookie", `jwt=${body.token}`);
        expect(res.status).toBe(401);
    });

    test("logout clears the cookie", async () => {
        const { agent } = await createUser();
        const res = await agent.post("/api/auth/logout");
        expect(res.status).toBe(200);
        expect(authCookie(res)).toMatch(/^jwt=;/);

        const after = await agent.get("/api/auth/me");
        expect(after.status).toBe(401);
    });
});

describe("app", () => {
    test("GET /healthz is ok", async () => {
        const res = await api().get("/healthz");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok" });
    });

    test("unknown routes get a JSON 404", async () => {
        const res = await api().get("/api/nothing-here");
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Not found" });
    });

    test("CORS allows the frontend origin with credentials", async () => {
        const res = await api().get("/healthz").set("Origin", "http://localhost:3000");
        expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
        expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    test("CORS does not allow other origins", async () => {
        const res = await api().get("/healthz").set("Origin", "https://evil.example");
        expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
});
