import { randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { createClient, type RedisClientType } from "redis";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { io as connect, type Socket } from "socket.io-client";
import { server } from "../app.ts";
import { setUpRedis } from "../config/redis.ts";
import { isOnline } from "../socket/socket.ts";
import { redisPresence } from "../socket/presence.ts";
import { createUser } from "./helpers.ts";

// Needs a real Redis: CI runs one as a service. Locally, for example:
//   docker run --rm -p 6390:6379 redis:8-alpine
//   TEST_REDIS_URL=redis://localhost:6390 pnpm test
const REDIS_URL = process.env.TEST_REDIS_URL;

const nextEvent = (socket: Socket, event: string, ms = 3000): Promise<any> =>
    new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`No "${event}" within ${ms}ms`)), ms);
        socket.once(event, (payload) => {
            clearTimeout(timer);
            resolve(payload);
        });
    });

const urlOf = (httpServer: http.Server) =>
    `http://localhost:${(httpServer.address() as AddressInfo).port}`;

describe.skipIf(!REDIS_URL)("with Redis", () => {
    let redis: RedisClientType;

    beforeAll(async () => {
        redis = createClient({ url: REDIS_URL });
        await redis.connect();
    });

    afterAll(async () => {
        await redis?.quit();
    });

    describe("shared online status", () => {
        test("a user on any server is online, until that server stops", async () => {
            const first = redisPresence(redis, `test-${randomUUID()}`);
            const second = redisPresence(redis, `test-${randomUUID()}`);
            const user = randomUUID();

            await second.connect(user);
            expect(await first.isOnline(user)).toBe(true);
            expect(await first.list()).toContain(user);

            await second.stop();
            expect(await first.isOnline(user)).toBe(false);
            await first.stop();
        });

        test("two tabs count once, and the user stays online until both close", async () => {
            const presence = redisPresence(redis, `test-${randomUUID()}`);
            const user = randomUUID();

            await presence.connect(user);
            await presence.connect(user);
            await presence.disconnect(user);
            expect(await presence.isOnline(user)).toBe(true);
            await presence.disconnect(user);
            expect(await presence.isOnline(user)).toBe(false);
            await presence.stop();
        });

        test("a server that crashed is dropped once its heartbeat runs out", async () => {
            const live = redisPresence(redis, `test-${randomUUID()}`);
            const crashedId = `test-${randomUUID()}`;
            const crashed = redisPresence(redis, crashedId);
            const user = randomUUID();
            await crashed.connect(user);

            // What an expired heartbeat looks like
            await redis.del(`presence:alive:${crashedId}`);

            expect(await live.isOnline(user)).toBe(false);
            expect(await redis.sIsMember("presence:instances", crashedId)).toBeFalsy();
            expect(await redis.exists(`presence:users:${crashedId}`)).toBe(0);
            await Promise.all([live.stop(), crashed.stop()]);
        });
    });

    describe("two servers", () => {
        let scaling: Awaited<ReturnType<typeof setUpRedis>>;
        let other: Server;
        let otherHttp: http.Server;
        let otherRedis: RedisClientType;
        let otherSub: RedisClientType;
        let otherPresence: ReturnType<typeof redisPresence>;
        const sockets: Socket[] = [];

        const open = async (url: string, agent) => {
            const { body } = await agent.get("/api/auth/socket-token");
            const socket = connect(url, { auth: { token: body.token }, transports: ["websocket"], reconnection: false });
            sockets.push(socket);
            return socket;
        };

        beforeAll(async () => {
            scaling = await setUpRedis(REDIS_URL);
            await new Promise<void>((resolve) => server.listen(0, resolve));

            // A second server on the same Redis, standing in for another
            // copy of the app: it checks the token and joins the user room
            otherRedis = redis.duplicate();
            otherSub = redis.duplicate();
            await Promise.all([otherRedis.connect(), otherSub.connect()]);
            otherPresence = redisPresence(otherRedis, `test-${randomUUID()}`);
            otherHttp = http.createServer();
            other = new Server(otherHttp, { adapter: createAdapter(otherRedis, otherSub) });
            other.on("connection", async (socket) => {
                const { userId } = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET) as JwtPayload;
                socket.join(userId);
                await otherPresence.connect(userId);
                socket.emit("ready");
            });
            await new Promise<void>((resolve) => otherHttp.listen(0, resolve));
        });

        afterAll(async () => {
            sockets.forEach((socket) => socket.disconnect());
            await otherPresence?.stop();
            await new Promise((resolve) => other.close(resolve));
            await Promise.all([otherRedis.quit(), otherSub.quit()]);
            await scaling?.close();
            await new Promise((resolve) => server.close(resolve));
        });

        test("a message reaches someone connected to the other server", async () => {
            const [alice, bob] = await Promise.all([createUser(), createUser()]);
            const bobSocket = await open(urlOf(otherHttp), bob.agent);
            await nextEvent(bobSocket, "ready");

            expect(await isOnline(bob.user._id)).toBe(true);

            // Alice's own socket is on the app server, and sees Bob online
            const aliceSocket = await open(urlOf(server), alice.agent);
            const online = await nextEvent(aliceSocket, "getOnlineUsers");
            expect(online).toEqual(expect.arrayContaining([alice.user._id, bob.user._id]));

            const received = nextEvent(bobSocket, "newMessage");
            await alice.agent.post(`/api/messages/send/${bob.user._id}`).send({ message: "across servers" });
            expect(await received).toMatchObject({ message: "across servers" });
        });

        test("the message rate limit is counted in Redis", async () => {
            const [alice, bob] = await Promise.all([createUser(), createUser()]);
            await alice.agent.post(`/api/messages/send/${bob.user._id}`).send({ message: "count me" });
            expect(await redis.get(`rate:messages:${alice.user._id}`)).toBe("1");
        });
    });
});
