// Load test for message delivery. Each virtual user is one pair of people:
// the receiver holds a Socket.IO WebSocket open and the sender posts a
// message every 2 seconds. Delivery latency is the time from starting the
// POST until the receiver's socket gets the "newMessage" event.
//
//   k6 run loadtest/chat.js                         # 50 pairs for 60 s
//   k6 run -e PAIRS=100 -e DURATION=120 loadtest/chat.js
//   k6 run -e BASE_URL=http://127.0.0.1:5000 -e SUMMARY=docs/benchmarks/k6.json loadtest/chat.js
//
// Never point it at production: it signs up two users per pair.

import http from "k6/http";
import { check } from "k6";
import exec from "k6/execution";
import { WebSocket } from "k6/websockets";
import { setInterval, clearInterval, setTimeout } from "k6/timers";
import { Rate, Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:5000";
const SOCKET_URL = `${BASE_URL.replace(/^http/, "ws")}/socket.io/?EIO=4&transport=websocket`;
const PAIRS = Number(__ENV.PAIRS || 50);
const DURATION = Number(__ENV.DURATION || 60);
// 30 messages a minute, under the limit of 50 per user
const SEND_EVERY_MS = 2000;
// A message not delivered within this long counts as lost
const GRACE_MS = 5000;

const latency = new Trend("delivery_latency", true);
const delivered = new Rate("delivered");
const sendFailed = new Rate("send_failed");

export const options = {
    setupTimeout: "10m",
    scenarios: {
        chat: {
            executor: "per-vu-iterations",
            vus: PAIRS,
            iterations: 1,
            maxDuration: `${DURATION + 60}s`,
        },
    },
    thresholds: {
        delivered: ["rate>0.99"],
        send_failed: ["rate<0.01"],
        delivery_latency: ["p(95)<1000"],
    },
    summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const json = { "Content-Type": "application/json" };
// Overrides the cookie jar, which would otherwise send the last user's login
const as = (user) => ({ headers: json, cookies: { jwt: { value: user.token, replace: true } } });

const signUp = (username) => {
    const res = http.post(
        `${BASE_URL}/api/auth/signup`,
        JSON.stringify({ fullName: username, username, password: "password123", confirmPassword: "password123" }),
        { headers: json },
    );
    check(res, { "signed up": (r) => r.status === 201 });
    return { id: res.json("_id"), token: res.cookies.jwt[0].value };
};

export function setup() {
    const run = Date.now().toString(36);
    const pairs = [];
    for (let i = 0; i < PAIRS; i += 1) {
        const sender = signUp(`k6s_${run}_${i}`);
        const receiver = signUp(`k6r_${run}_${i}`);
        const first = http.post(
            `${BASE_URL}/api/messages/send/${receiver.id}`,
            JSON.stringify({ message: "hello" }),
            as(sender),
        );
        pairs.push({ sender, receiver, chatId: first.json("newConversation._id") });
    }
    return { pairs };
}

export default function (data) {
    const pair = data.pairs[exec.vu.idInTest - 1];
    const sendUrl = `${BASE_URL}/api/messages/send/${pair.chatId}`;
    const socketToken = http.get(`${BASE_URL}/api/auth/socket-token`, as(pair.receiver)).json("token");

    const sentAt = new Map();
    let count = 0;
    let sender;

    const ws = new WebSocket(SOCKET_URL);

    const startSending = () => {
        sender = setInterval(() => {
            const text = `k6 ${exec.vu.idInTest} ${count++}`;
            sentAt.set(text, Date.now());
            http.asyncRequest("POST", sendUrl, JSON.stringify({ message: text }), as(pair.sender)).then(
                (res) => sendFailed.add(res.status !== 201),
            );
        }, SEND_EVERY_MS);

        setTimeout(() => {
            clearInterval(sender);
            setTimeout(() => {
                sentAt.forEach(() => delivered.add(false));
                ws.close();
            }, GRACE_MS);
        }, DURATION * 1000);
    };

    // Engine.IO framing: 0 = open, 2 = ping, 40 = namespace connected,
    // 42 = event
    ws.onmessage = (event) => {
        const frame = event.data;
        if (frame === "2") {
            ws.send("3");
        } else if (frame.startsWith("0")) {
            ws.send(`40${JSON.stringify({ token: socketToken })}`);
        } else if (frame.startsWith("40")) {
            startSending();
        } else if (frame.startsWith("44")) {
            console.error(`Socket refused: ${frame}`);
            ws.close();
        } else if (frame.startsWith("42")) {
            const [name, payload] = JSON.parse(frame.slice(2));
            if (name !== "newMessage") return;
            const started = sentAt.get(payload.message);
            if (started === undefined) return;
            sentAt.delete(payload.message);
            latency.add(Date.now() - started);
            delivered.add(true);
        }
    };

    ws.onerror = (event) => console.error(`WebSocket error: ${event.error}`);
}

const round = (value) => (typeof value === "number" ? Math.round(value * 10) / 10 : value);

export function handleSummary(data) {
    const metric = (name) => data.metrics[name]?.values ?? {};
    const lat = metric("delivery_latency");
    const summary = {
        target: BASE_URL,
        pairs: PAIRS,
        durationSeconds: DURATION,
        messagesPerSecond: round(PAIRS / (SEND_EVERY_MS / 1000)),
        delivered: metric("delivered").passes ?? 0,
        lost: metric("delivered").fails ?? 0,
        deliveredRate: round(metric("delivered").rate),
        sendErrorRate: round(metric("send_failed").rate),
        latencyMs: { p50: round(lat.med), p90: round(lat["p(90)"]), p95: round(lat["p(95)"]), p99: round(lat["p(99)"]), max: round(lat.max) },
    };
    const text = `\n${JSON.stringify(summary, null, 2)}\n`;
    const out = { stdout: text };
    if (__ENV.SUMMARY) out[__ENV.SUMMARY] = text.trimStart();
    return out;
}
