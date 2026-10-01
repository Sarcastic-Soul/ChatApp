import { randomUUID } from "node:crypto";
import type { RedisClientType } from "redis";

// Who is online. One server keeps it in memory; several servers share it
// in Redis, so each one sees users connected to the others.
export interface Presence {
    connect: (userId: string) => Promise<void>;
    disconnect: (userId: string) => Promise<void>;
    isOnline: (userId: string) => Promise<boolean>;
    list: () => Promise<string[]>;
    stop: () => Promise<void>;
}

// userId -> number of open sockets (a user can have several tabs open)
export const memoryPresence = (): Presence => {
    const counts = new Map<string, number>();
    return {
        connect: async (userId) => {
            counts.set(userId, (counts.get(userId) || 0) + 1);
        },
        disconnect: async (userId) => {
            const count = (counts.get(userId) || 1) - 1;
            if (count > 0) counts.set(userId, count);
            else counts.delete(userId);
        },
        isOnline: async (userId) => counts.has(userId),
        list: async () => [...counts.keys()],
        stop: async () => counts.clear(),
    };
};

const INSTANCES = "presence:instances";
const usersKey = (instanceId: string) => `presence:users:${instanceId}`;
const aliveKey = (instanceId: string) => `presence:alive:${instanceId}`;

// How long a server counts as alive after its last heartbeat
const ALIVE_SECONDS = 30;
const HEARTBEAT_MS = 10_000;

// Each server keeps its own hash of userId -> open sockets, plus an "alive"
// key it refreshes every 10 seconds. A user is online if any live server
// has them. When a server crashes its alive key expires, and the next
// server to list users deletes the dead server's hash.
export const redisPresence = (redis: RedisClientType, instanceId: string = randomUUID()): Presence => {
    const heartbeat = () =>
        redis
            .multi()
            .sAdd(INSTANCES, instanceId)
            .set(aliveKey(instanceId), "1", { expiration: { type: "EX", value: ALIVE_SECONDS } })
            .exec();

    let started: Promise<unknown> = heartbeat();
    const timer = setInterval(() => {
        started = heartbeat().catch((error) => console.error("Presence heartbeat failed:", error));
    }, HEARTBEAT_MS);
    timer.unref();

    // Live server ids, after clearing out any that stopped sending heartbeats
    const liveInstances = async () => {
        await started;
        const ids = await redis.sMembers(INSTANCES);
        if (!ids.length) return [];
        const alive = await Promise.all(ids.map((id) => redis.exists(aliveKey(id))));
        const dead = ids.filter((_id, index) => !alive[index]);
        if (dead.length) {
            await redis
                .multi()
                .sRem(INSTANCES, dead)
                .del(dead.map(usersKey))
                .exec();
        }
        return ids.filter((_id, index) => alive[index]);
    };

    return {
        connect: async (userId) => {
            await redis.hIncrBy(usersKey(instanceId), userId, 1);
        },
        disconnect: async (userId) => {
            const count = await redis.hIncrBy(usersKey(instanceId), userId, -1);
            if (count <= 0) await redis.hDel(usersKey(instanceId), userId);
        },
        isOnline: async (userId) => {
            const ids = await liveInstances();
            const found = await Promise.all(ids.map((id) => redis.hExists(usersKey(id), userId)));
            return found.some(Boolean);
        },
        list: async () => {
            const ids = await liveInstances();
            const users = await Promise.all(ids.map((id) => redis.hKeys(usersKey(id))));
            return [...new Set(users.flat())];
        },
        stop: async () => {
            clearInterval(timer);
            await redis
                .multi()
                .sRem(INSTANCES, instanceId)
                .del([usersKey(instanceId), aliveKey(instanceId)])
                .exec();
        },
    };
};
