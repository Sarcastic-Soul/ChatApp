// ICE servers for WebRTC calls. STUN alone fails when both people are behind
// strict NATs (mobile data, office networks), so calls also get a TURN relay
// when one is set up. Two providers work:
//   Cloudflare: CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN
//   Metered:    METERED_DOMAIN (e.g. yourapp.metered.live) and METERED_API_KEY
// With neither set, calls fall back to public STUN servers only.

const STUN_SERVERS = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

// Credentials live for a day; they are cached and handed out for half that,
// so a call never starts with credentials that are about to expire
const TTL_SECONDS = 24 * 60 * 60;
let cached = null;

// Browsers time out on TURN over port 53, so Cloudflare suggests dropping it
const dropPort53 = (servers) =>
    servers
        .map((server) => ({
            ...server,
            urls: [server.urls].flat().filter((url) => !/:53(\?|$)/.test(url)),
        }))
        .filter((server) => server.urls.length > 0);

const fetchCloudflare = async () => {
    const res = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${process.env.CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.CLOUDFLARE_TURN_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ ttl: TTL_SECONDS }),
        },
    );
    if (!res.ok) throw new Error(`Cloudflare TURN returned ${res.status}`);
    const { iceServers } = await res.json();
    return dropPort53([iceServers].flat());
};

const fetchMetered = async () => {
    const url = new URL(`https://${process.env.METERED_DOMAIN}/api/v1/turn/credentials`);
    url.searchParams.set("apiKey", process.env.METERED_API_KEY);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Metered TURN returned ${res.status}`);
    return res.json();
};

const turnProvider = () => {
    if (process.env.CLOUDFLARE_TURN_KEY_ID && process.env.CLOUDFLARE_TURN_API_TOKEN) return fetchCloudflare;
    if (process.env.METERED_DOMAIN && process.env.METERED_API_KEY) return fetchMetered;
    return null;
};

export const getIceServers = async (req, res) => {
    const provider = turnProvider();
    if (!provider) {
        return res.status(200).json({ iceServers: STUN_SERVERS, turn: false });
    }

    if (cached && cached.expiresAt > Date.now()) {
        return res.status(200).json({ iceServers: cached.iceServers, turn: true });
    }

    try {
        const turnServers = await provider();
        const iceServers = [...STUN_SERVERS, ...turnServers];
        cached = { iceServers, expiresAt: Date.now() + (TTL_SECONDS / 2) * 1000 };
        res.status(200).json({ iceServers, turn: true });
    } catch (error) {
        // A broken TURN setup should not stop calls on networks where STUN works
        console.error("Error fetching TURN credentials:", error.message);
        res.status(200).json({ iceServers: STUN_SERVERS, turn: false });
    }
};

// For tests
export const clearIceServerCache = () => {
    cached = null;
};
