import type { RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import type { RedisClientType } from "redis";

// Limit message sending: 50 messages per minute per user
const messageLimitOptions = {
    windowMs: 60 * 1000, // 1 minute
    max: 50, // Limit each user to 50 requests per windowMs
    message: {
        error: "Too many messages sent. Please try again after a minute.",
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => {
        // Use user ID for rate limiting if available, otherwise fallback to IP
        const forwardedFor = req.headers["x-forwarded-for"];
        return req.user
            ? req.user._id.toString()
            : (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor) ||
                  req.socket.remoteAddress ||
                  "unknown";
    },
} satisfies Parameters<typeof rateLimit>[0];

// Kept in memory unless config/redis.ts switches it to Redis, so every
// server counts the same messages
let messageLimiter = rateLimit(messageLimitOptions);

export const useRedisRateLimits = (redis: RedisClientType) => {
    messageLimiter = rateLimit({
        ...messageLimitOptions,
        store: new RedisStore({
            prefix: "rate:messages:",
            sendCommand: (...args: string[]) => redis.sendCommand(args),
        }),
    });
};

export const messageRateLimiter: RequestHandler = (req, res, next) => messageLimiter(req, res, next);
