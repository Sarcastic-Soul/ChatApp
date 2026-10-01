// Service worker for Web Push. The backend only sends a push when the
// person has no tab open, so every push becomes a notification.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
