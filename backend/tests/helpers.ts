import request from "supertest";
import { app } from "../app.ts";

let count = 0;

// Signs up a new user and returns a supertest agent that carries their
// auth cookie, plus the user returned by the API
export const createUser = async (overrides: Record<string, unknown> = {}) => {
    count += 1;
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/signup").send({
        fullName: `Test User ${count}`,
        username: `user_${count}_${Date.now()}`,
        password: "password123",
        confirmPassword: "password123",
        ...overrides,
    });
    if (res.status !== 201) {
        throw new Error(`Signup failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return { agent, user: res.body };
};

export const api = () => request(app);

// A valid id that matches no document
export const missingId = "0123456789abcdef01234567";
