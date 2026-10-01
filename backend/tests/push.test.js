import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import webPush from "web-push";
import PushSubscription from "../models/pushSubscription.model.js";
import { api, createUser } from "./helpers.js";

vi.mock("web-push", () => ({
    default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));

const subscription = (n = 1) => ({
    endpoint: `https://push.example.com/send/${n}`,
    keys: { p256dh: `p256dh-key-${n}`, auth: `auth-${n}` },
});

const enablePush = () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "test-public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
};

afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
});

describe("GET /api/push/public-key", () => {
    test("is a 404 when push is not set up", async () => {
        const res = await api().get("/api/push/public-key");
        expect(res.status).toBe(404);
    });

    test("returns the VAPID public key", async () => {
        enablePush();
        const res = await api().get("/api/push/public-key");
        expect(res.status).toBe(200);
        expect(res.body.publicKey).toBe("test-public-key");
    });
});

describe("POST /api/push/subscribe and /unsubscribe", () => {
    test("needs a login", async () => {
        const res = await api().post("/api/push/subscribe").send(subscription());
        expect(res.status).toBe(401);
    });

    test("rejects a subscription without keys or with a non-https endpoint", async () => {
        const { agent } = await createUser();

        const noKeys = await agent.post("/api/push/subscribe").send({ endpoint: "https://push.example.com/x" });
        expect(noKeys.status).toBe(400);

        const http = await agent.post("/api/push/subscribe").send({ ...subscription(), endpoint: "http://push.example.com/x" });
        expect(http.status).toBe(400);
    });

    test("saves one subscription per endpoint and moves it to the newest user", async () => {
        const { agent: alice, user: aliceUser } = await createUser();
        const { agent: bob, user: bobUser } = await createUser();

        expect((await alice.post("/api/push/subscribe").send(subscription(7))).status).toBe(201);
        expect((await alice.post("/api/push/subscribe").send(subscription(7))).status).toBe(201);
        let saved = await PushSubscription.find({ endpoint: subscription(7).endpoint });
        expect(saved).toHaveLength(1);
        expect(saved[0].userId.toString()).toBe(aliceUser._id);

        await bob.post("/api/push/subscribe").send(subscription(7));
        saved = await PushSubscription.find({ endpoint: subscription(7).endpoint });
        expect(saved).toHaveLength(1);
        expect(saved[0].userId.toString()).toBe(bobUser._id);
    });

    test("only removes your own subscription", async () => {
        const { agent: alice } = await createUser();
        const { agent: bob } = await createUser();
        await alice.post("/api/push/subscribe").send(subscription(8));

        await bob.post("/api/push/unsubscribe").send({ endpoint: subscription(8).endpoint });
        expect(await PushSubscription.countDocuments({ endpoint: subscription(8).endpoint })).toBe(1);

        const res = await alice.post("/api/push/unsubscribe").send({ endpoint: subscription(8).endpoint });
        expect(res.status).toBe(200);
        expect(await PushSubscription.countDocuments({ endpoint: subscription(8).endpoint })).toBe(0);
    });
});

describe("notifications for new messages", () => {
    let alice, bob, bobUser;

    beforeEach(async () => {
        ({ agent: alice } = await createUser({ fullName: "Alice Sender" }));
        ({ agent: bob, user: bobUser } = await createUser());
        await bob.post("/api/push/subscribe").send(subscription(20));
        await alice.post("/api/push/subscribe").send(subscription(21));
    });

    test("pushes to an offline receiver, not to the sender", async () => {
        enablePush();
        const res = await alice.post(`/api/messages/send/${bobUser._id}`).send({ message: "Are you around?" });
        expect(res.status).toBe(201);

        await vi.waitFor(() => expect(webPush.sendNotification).toHaveBeenCalledTimes(1));
        const [target, body] = webPush.sendNotification.mock.calls[0];
        expect(target.endpoint).toBe(subscription(20).endpoint);
        const payload = JSON.parse(body);
        expect(payload).toMatchObject({
            title: "Alice Sender",
            body: "Are you around?",
            conversationId: res.body.newConversation._id,
            url: `/?chat=${res.body.newConversation._id}`,
        });
    });

    test("names the group and the sender in group chats", async () => {
        enablePush();
        const group = await alice
            .post("/api/groups/create")
            .send({ name: "Weekend trip", participants: [bobUser._id] });
        expect(group.status).toBe(201);
        vi.clearAllMocks();

        await alice.post(`/api/messages/send/${group.body._id}`).send({ message: "Tickets booked" });

        await vi.waitFor(() => expect(webPush.sendNotification).toHaveBeenCalled());
        const payloads = webPush.sendNotification.mock.calls.map(([, body]) => JSON.parse(body));
        expect(payloads.filter((p) => p.body === "Alice Sender: Tickets booked")).toHaveLength(1);
        expect(payloads.every((p) => p.title === "Weekend trip")).toBe(true);
        expect(webPush.sendNotification.mock.calls.map(([t]) => t.endpoint)).not.toContain(subscription(21).endpoint);
    });

    test("deletes subscriptions the push service has dropped", async () => {
        enablePush();
        webPush.sendNotification.mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }));

        await alice.post(`/api/messages/send/${bobUser._id}`).send({ message: "Hello?" });

        await vi.waitFor(async () =>
            expect(await PushSubscription.countDocuments({ endpoint: subscription(20).endpoint })).toBe(0),
        );
    });

    test("sends nothing when push is not set up", async () => {
        await alice.post(`/api/messages/send/${bobUser._id}`).send({ message: "Quiet" });
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(webPush.sendNotification).not.toHaveBeenCalled();
    });
});
