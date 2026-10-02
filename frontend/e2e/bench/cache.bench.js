import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Measures how long it takes from clicking a chat until its newest message
// is on screen, with an empty IndexedDB cache (cold) and a filled one (warm).
// Run with `pnpm run bench:cache`. Results go to docs/benchmarks/cache.json.

const RUNS = Number(process.env.RUNS) || 10;
const MESSAGES = 50;

// Chrome DevTools network presets
const NETWORKS = {
    "No throttling": null,
    "Fast 4G": { latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 },
    "Slow 4G": { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
    "3G": { latency: 300, downloadThroughput: (750 * 1024) / 8, uploadThroughput: (250 * 1024) / 8 },
};

const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const p90 = (values) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.9) - 1];

test.setTimeout(30 * 60_000);

test("IndexedDB cache: time to show a chat", async ({ browser }) => {
    const stamp = Date.now().toString(36);
    const context = await browser.newContext();
    const page = await context.newPage();

    // Two users and one chat with MESSAGES messages, made through the API
    const api = context.request;
    const signup = (name) =>
        api.post("/api/auth/signup", {
            data: { fullName: name, username: `${name.toLowerCase()}_${stamp}`, password: "password123", confirmPassword: "password123" },
        });
    const bob = await (await signup("Bob")).json();
    const alice = await (await signup("Alice")).json();
    expect(alice._id).toBeTruthy();

    let chatId;
    for (let i = 1; i <= MESSAGES; i++) {
        const res = await api.post(`/api/messages/send/${chatId ?? bob._id}`, {
            data: { message: `Benchmark message ${i} — ${"lorem ipsum dolor sit amet ".repeat(4)}` },
        });
        expect(res.status()).toBe(201);
        chatId ??= (await res.json()).newConversation._id;
    }
    const lastMessage = `Benchmark message ${MESSAGES} —`;
    const lastText = page.getByText(lastMessage);

    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");

    // Fresh page load, then time the click on the chat
    const openChat = async ({ cold }) => {
        if (cold) {
            await page.evaluate(
                () =>
                    new Promise((resolve, reject) => {
                        const req = indexedDB.deleteDatabase("chat-db");
                        req.onsuccess = resolve;
                        req.onerror = reject;
                        req.onblocked = resolve;
                    }),
            );
        }
        await page.reload();
        const chat = page.getByRole("navigation", { name: "Chats" }).getByText("Bob").first();
        await chat.waitFor({ timeout: 60_000 });
        // Timed inside the page: click, then watch the DOM until the newest
        // message's text shows up
        const elapsed = await (await chat.elementHandle()).evaluate(
            (button, text) =>
                new Promise((resolve, reject) => {
                    const start = performance.now();
                    const observer = new MutationObserver(() => {
                        if (document.querySelector("main")?.textContent.includes(text)) {
                            observer.disconnect();
                            resolve(Math.round(performance.now() - start));
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
                    setTimeout(() => reject(new Error("Chat never showed its messages")), 60_000);
                    button.click();
                }),
            lastMessage,
        );
        await lastText.waitFor();
        // Let the background refresh finish, so the next run starts clean
        await page.waitForLoadState("networkidle");
        return elapsed;
    };

    // The app keeps the logged-in user in localStorage next to the cookie
    await page.goto("/login");
    await page.evaluate((user) => localStorage.setItem("chat-user", JSON.stringify(user)), alice);
    // Alice turns on encryption once; her key stays in its own IndexedDB
    // database, which the cold runs leave alone. Bob never does, so the
    // chat stays plain text and the numbers compare with older runs.
    await page.goto("/");
    await page.getByRole("textbox", { name: "Passphrase", exact: true }).fill("benchmark passphrase");
    await page.getByRole("textbox", { name: "Confirm passphrase" }).fill("benchmark passphrase");
    await page.getByRole("button", { name: "Turn on encryption" }).click();
    await page.getByRole("navigation", { name: "Chats" }).waitFor();
    const results = {};

    for (const [network, conditions] of Object.entries(NETWORKS)) {
        await cdp.send(
            "Network.emulateNetworkConditions",
            conditions ? { offline: false, ...conditions } : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
        );

        const cold = [];
        const warm = [];
        await openChat({ cold: false }); // warm-up run, not counted
        for (let i = 0; i < RUNS; i++) {
            cold.push(await openChat({ cold: true }));
            warm.push(await openChat({ cold: false }));
        }

        const coldMedian = median(cold);
        const warmMedian = median(warm);
        results[network] = {
            coldMedianMs: coldMedian,
            warmMedianMs: warmMedian,
            coldP90Ms: p90(cold),
            warmP90Ms: p90(warm),
            fasterBy: `${Math.round((1 - warmMedian / coldMedian) * 100)}%`,
            cold,
            warm,
        };
        console.log(`${network}: cold ${coldMedian} ms, warm ${warmMedian} ms, ${results[network].fasterBy} faster`);
    }

    writeFileSync(
        new URL("../../../docs/benchmarks/cache.json", import.meta.url),
        JSON.stringify(
            {
                measured: new Date().toISOString().slice(0, 10),
                what: `Click on a chat until its newest message is visible. ${MESSAGES} messages, ${RUNS} runs per case, median and p90 in ms. Production build served locally, network shaped with Chrome DevTools presets.`,
                results,
            },
            null,
            2,
        ) + "\n",
    );

    await context.close();
});
