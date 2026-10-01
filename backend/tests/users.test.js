import { beforeAll, describe, expect, test } from "vitest";
import { api, createUser } from "./helpers.js";

let alice, bob, hidden;

beforeAll(async () => {
    [alice, bob, hidden] = await Promise.all([createUser(), createUser(), createUser()]);
    await hidden.agent.put("/api/users/privacy").send({ isPublic: false });
});

describe("user lists", () => {
    test("the sidebar lists public users other than me, without passwords", async () => {
        const res = await alice.agent.get("/api/users");
        expect(res.status).toBe(200);
        const ids = res.body.map((u) => u._id);
        expect(ids).toContain(bob.user._id);
        expect(ids).not.toContain(alice.user._id);
        expect(ids).not.toContain(hidden.user._id);
        expect(res.body.every((u) => !("password" in u))).toBe(true);
    });

    test("new chat leaves out people I already talk to", async () => {
        const carol = await createUser();
        await carol.agent.post(`/api/messages/send/${bob.user._id}`).send({ message: "hi" });

        const res = await carol.agent.get("/api/users/new");
        const ids = res.body.map((u) => u._id);
        expect(ids).not.toContain(bob.user._id);
        expect(ids).toContain(alice.user._id);
    });

    test("conversations show the other person in 1-on-1 chats", async () => {
        const dave = await createUser({ fullName: "Dave Kim" });
        await dave.agent.post(`/api/messages/send/${alice.user._id}`).send({ message: "hi" });

        const res = await alice.agent.get("/api/users/conversations");
        const chat = res.body.find((c) => c.participantId === dave.user._id);
        expect(chat).toMatchObject({ isGroupChat: false, fullName: "Dave Kim", username: dave.user.username });
    });

    test("conversations need a login", async () => {
        const res = await api().get("/api/users/conversations");
        expect(res.status).toBe(401);
    });
});

describe("profile", () => {
    test("look up a user by username", async () => {
        const res = await alice.agent.get(`/api/users/${bob.user.username}`);
        expect(res.status).toBe(200);
        expect(res.body._id).toBe(bob.user._id);
        expect(res.body).not.toHaveProperty("password");
    });

    test("unknown username is 404", async () => {
        const res = await alice.agent.get("/api/users/no_such_person");
        expect(res.status).toBe(404);
    });

    test("profile picture must be an https link", async () => {
        const bad = await alice.agent.put("/api/users/update-pic").send({ profilePic: "data:image/png;base64,AAA" });
        expect(bad.status).toBe(400);
        expect(bad.body.error).toBe("Profile picture must be an https link");

        const url = "https://res.cloudinary.com/demo/image/upload/me.jpg";
        const res = await alice.agent.put("/api/users/update-pic").send({ profilePic: url });
        expect(res.status).toBe(200);
        expect(res.body.profilePic).toBe(url);
    });

    test("privacy must be a real boolean", async () => {
        const bad = await alice.agent.put("/api/users/privacy").send({ isPublic: "false" });
        expect(bad.status).toBe(400);
        expect(bad.body.error).toBe("Privacy setting must be true or false");
    });
});

describe("cloudinary signatures", () => {
    test.each([
        ["/api/cloudinary/signature", "MERN-ChatApp/chat_app_media"],
        ["/api/cloudinary/signature/profile-pic", "MERN-ChatApp/profile_pic"],
        ["/api/cloudinary/signature/group-icon", "MERN-ChatApp/group_icons"],
    ])("%s signs uploads for its folder", async (path, folder) => {
        const res = await alice.agent.get(path);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ folder, cloudName: "test-cloud", apiKey: "123456789" });
        expect(res.body.signature).toMatch(/^[a-f\d]{40}$/);
        expect(res.body).not.toHaveProperty("apiSecret");
    });
});
