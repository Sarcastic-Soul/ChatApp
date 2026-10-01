// Web Push in the browser: the service worker, the permission prompt and
// the subscription the backend sends notifications to.

export const isPushSupported = () =>
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

// iPhones and iPads only allow push for apps added to the home screen
export const needsHomeScreen = () =>
    /iPhone|iPad|iPod/.test(navigator.userAgent) &&
    !window.matchMedia("(display-mode: standalone)").matches;

export const registerServiceWorker = () => {
    if (!isPushSupported()) return Promise.resolve(null);
    return navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Service worker registration failed:", error);
        return null;
    });
};

const getSubscription = async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
};

// The VAPID key arrives as base64url; PushManager wants bytes
const toBytes = (base64url: string) => {
    const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

const saveSubscription = async (subscription: PushSubscription) => {
    const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(subscription.toJSON()),
    });
    if (!res.ok) throw new Error("Couldn't turn on notifications");
};

// null when the server has no VAPID keys, so the setting is hidden
export const getPushPublicKey = async (): Promise<string | null> => {
    const res = await fetch("/api/push/public-key");
    if (!res.ok) return null;
    const { publicKey } = (await res.json()) as { publicKey?: string };
    return publicKey || null;
};

export const isSubscribed = async () => {
    if (!isPushSupported() || Notification.permission !== "granted") return false;
    return Boolean(await getSubscription());
};

// Must run from a click, since browsers only show the prompt after one
export const enablePush = async (publicKey: string) => {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
        throw new Error(
            permission === "denied"
                ? "Notifications are blocked. Allow them in your browser's site settings."
                : "Notifications were not allowed",
        );
    }
    await registerServiceWorker();
    const registration = await navigator.serviceWorker.ready;
    const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: toBytes(publicKey),
        }));
    await saveSubscription(subscription);
};

export const disablePush = async () => {
    if (!isPushSupported()) return;
    const subscription = await getSubscription();
    if (!subscription) return;
    await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {});
    await subscription.unsubscribe();
};

// Sends the browser's subscription to the server again on each visit, in
// case it changed or was saved under another account on this browser
export const resyncSubscription = async () => {
    if (!(await isSubscribed())) return;
    const subscription = await getSubscription();
    if (subscription) await saveSubscription(subscription).catch(() => {});
};
