import type { Message } from "../types";

// The lengths the disappearing messages timer can be set to, in seconds
export const TIMER_CHOICES = [
    { seconds: 0, label: "Off" },
    { seconds: 3600, label: "1 hour" },
    { seconds: 86400, label: "1 day" },
    { seconds: 604800, label: "7 days" },
];

export const timerLabel = (seconds?: number) =>
    TIMER_CHOICES.find((choice) => choice.seconds === (seconds ?? 0))?.label ?? "Off";

// A disappearing message whose time has passed. The server stops sending
// it; this hides copies already on screen or in the cache.
export const hasExpired = (message: Pick<Message, "expiresAt">, now = Date.now()) =>
    !!message.expiresAt && new Date(message.expiresAt).getTime() <= now;
