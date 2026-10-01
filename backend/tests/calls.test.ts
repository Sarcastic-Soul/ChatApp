import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { clearIceServerCache } from "../controllers/call.controller.ts";
import { api, createUser } from "./helpers.ts";

let alice;

beforeAll(async () => {
    ({ agent: alice } = await createUser());
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    clearIceServerCache();
});

const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("GET /api/calls/ice-servers", () => {
    test("needs a login", async () => {
        const res = await api().get("/api/calls/ice-servers");
        expect(res.status).toBe(401);
    });

    test("returns only STUN when no TURN provider is set up", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch");
        const res = await alice.get("/api/calls/ice-servers");

        expect(res.status).toBe(200);
        expect(res.body.turn).toBe(false);
        expect(res.body.iceServers).toEqual([{ urls: expect.arrayContaining(["stun:stun.l.google.com:19302"]) }]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    test("adds Cloudflare TURN credentials, without the port 53 URLs", async () => {
        vi.stubEnv("CLOUDFLARE_TURN_KEY_ID", "key-id");
        vi.stubEnv("CLOUDFLARE_TURN_API_TOKEN", "api-token");
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            json({
                iceServers: [
                    { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
                    {
                        urls: [
                            "turn:turn.cloudflare.com:3478?transport=udp",
                            "turn:turn.cloudflare.com:53?transport=udp",
                            "turns:turn.cloudflare.com:5349?transport=tcp",
                        ],
                        username: "user",
                        credential: "secret",
                    },
                ],
            }),
        );

        const res = await alice.get("/api/calls/ice-servers");

        expect(res.status).toBe(200);
        expect(res.body.turn).toBe(true);
        const [url, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
        expect(url).toBe("https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers");
        expect(options.headers.Authorization).toBe("Bearer api-token");
        expect(res.body.iceServers).toContainEqual({
            urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turns:turn.cloudflare.com:5349?transport=tcp"],
            username: "user",
            credential: "secret",
        });
        expect(res.body.iceServers.flatMap((s) => s.urls).filter((u) => /:53(\?|$)/.test(u))).toEqual([]);
    });

    test("adds Metered TURN credentials", async () => {
        vi.stubEnv("METERED_DOMAIN", "chat.metered.live");
        vi.stubEnv("METERED_API_KEY", "metered-key");
        const turn = { urls: "turn:global.relay.metered.ca:80", username: "u", credential: "c" };
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json([turn]));

        const res = await alice.get("/api/calls/ice-servers");

        expect(String(fetchMock.mock.calls[0][0])).toBe(
            "https://chat.metered.live/api/v1/turn/credentials?apiKey=metered-key",
        );
        expect(res.body.turn).toBe(true);
        expect(res.body.iceServers).toContainEqual(turn);
    });

    test("caches the credentials between calls", async () => {
        vi.stubEnv("METERED_DOMAIN", "chat.metered.live");
        vi.stubEnv("METERED_API_KEY", "metered-key");
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockImplementation(async () => json([{ urls: "turn:relay:80", username: "u", credential: "c" }]));

        await alice.get("/api/calls/ice-servers");
        await alice.get("/api/calls/ice-servers");

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("falls back to STUN when the provider fails", async () => {
        vi.stubEnv("CLOUDFLARE_TURN_KEY_ID", "key-id");
        vi.stubEnv("CLOUDFLARE_TURN_API_TOKEN", "bad-token");
        vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("unauthorized", { status: 401 }));
        vi.spyOn(console, "error").mockImplementation(() => {});

        const res = await alice.get("/api/calls/ice-servers");

        expect(res.status).toBe(200);
        expect(res.body.turn).toBe(false);
        expect(res.body.iceServers).toHaveLength(1);
    });
});
