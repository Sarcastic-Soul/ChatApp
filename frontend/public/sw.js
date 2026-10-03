// Service worker: keeps the app's own files so it opens with no network,
// and shows Web Push notifications.

const SHELL = "shell-v1";
const MAX_FILES = 120;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const save = async (request, response) => {
    if (!response.ok || response.type !== "basic") return;
    const cache = await caches.open(SHELL);
    await cache.put(request, response.clone());
    // Old builds leave files behind; drop the oldest
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_FILES)).map((key) => cache.delete(key)));
};

// Pages: the network copy when there is one, else the saved app page.
// Every route is the same single page, so it is saved once as "/".
const page = async (request) => {
    try {
        const response = await fetch(request);
        await save("/", response);
        return response;
    } catch (error) {
        const saved = await caches.match("/");
        if (saved) return saved;
        throw error;
    }
};

// Built files have a hash in their name and never change: saved copy first
const builtFile = async (request) => {
    const saved = await caches.match(request);
    if (saved) return saved;
    const response = await fetch(request);
    await save(request, response);
    return response;
};

// Icons, the manifest and the like: network first, saved copy when offline
const otherFile = async (request) => {
    try {
        const response = await fetch(request);
        await save(request, response);
        return response;
    } catch (error) {
        const saved = await caches.match(request);
        if (saved) return saved;
        throw error;
    }
};

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== "GET" || url.origin !== self.location.origin) return;
    // The API, sockets and the API reference always go to the network
    if (/^\/(api|socket\.io|docs)(\/|$)/.test(url.pathname) || url.pathname === "/sw.js") return;

    if (request.mode === "navigate") event.respondWith(page(request));
    else if (url.pathname.startsWith("/assets/")) event.respondWith(builtFile(request));
    else event.respondWith(otherFile(request));
});

// The backend only sends a push when the person has no tab open, so
// every push becomes a notification.

self.addEventListener("push", (event) => {
    let data;
    try {
        data = event.data ? event.data.json() : {};
    } catch {
        data = { body: event.data?.text() };
    }

    event.waitUntil(
        self.registration.showNotification(data.title || "ChatApp", {
            body: data.body || "New message",
            icon: data.icon || "/icon-192.png",
            badge: "/icon-192.png",
            // One notification per chat; a newer message replaces it
            tag: data.tag,
            renotify: Boolean(data.tag),
            data: { url: data.url || "/", conversationId: data.conversationId },
        }),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const { url, conversationId } = event.notification.data || {};

    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
            const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
            if (open) {
                await open.focus();
                open.postMessage({ type: "open-chat", conversationId });
                return;
            }
            await self.clients.openWindow(url || "/");
        })(),
    );
});
