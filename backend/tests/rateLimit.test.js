import { expect, test } from "vitest";
import { createUser } from "./helpers.js";

// Its own file, so the limiter's memory store starts empty
test("a user can send 50 messages a minute, then gets 429", async () => {
    const [sender, receiver, other] = await Promise.all([createUser(), createUser(), createUser()]);

    const first = await sender.agent.post(`/api/messages/send/${receiver.user._id}`).send({ message: "0" });
    const chatId = first.body.newConversation._id;

    for (let i = 1; i < 50; i++) {
        const res = await sender.agent.post(`/api/messages/send/${chatId}`).send({ message: String(i) });
        expect(res.status).toBe(201);
    }

    const blocked = await sender.agent.post(`/api/messages/send/${chatId}`).send({ message: "one too many" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("Too many messages sent. Please try again after a minute.");
    expect(blocked.headers).toHaveProperty("ratelimit-limit");

    // The limit is per user, not shared
    const fine = await other.agent.post(`/api/messages/send/${chatId}`).send({ message: "hi" });
    expect(fine.status).not.toBe(429);
});
