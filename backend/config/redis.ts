import { createClient, type RedisClientType } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { io, setPresence } from "../socket/socket.ts";
import { redisPresence } from "../socket/presence.ts";
import { useRedisRateLimits } from "../middleware/rateLimiter.ts";

// With REDIS_URL set, several copies of the server can run side by side:
// socket events reach users on any copy through the Redis adapter, and
// online status and rate limits are shared. Without it, one server keeps
// everything in memory, which is what Render's free tier runs.
export const setUpRedis = async (url = process.env.REDIS_URL) => {
    if (!url) return null;

    const client: RedisClientType = createClient({ url });
    const subscriber = client.duplicate();
    client.on("error", (error) => console.error("Redis error:", error));
    subscriber.on("error", (error) => console.error("Redis subscriber error:", error));
    await Promise.all([client.connect(), subscriber.connect()]);

    io.adapter(createAdapter(client, subscriber));
    const presence = redisPresence(client);
    setPresence(presence);
    useRedisRateLimits(client);
    console.log("Redis connected: sockets, online status and rate limits are shared.");

    return {
        client,
        close: async () => {
            await presence.stop();
            await Promise.all([client.quit(), subscriber.quit()]);
        },
    };
};
