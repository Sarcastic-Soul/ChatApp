import webPush from "web-push";
import PushSubscription from "../models/pushSubscription.model.js";

// Web Push needs a VAPID key pair (npx web-push generate-vapid-keys) and a
// contact address for the push services. Without them, push is off and
// sendPushToUsers does nothing.
let configuredWith = null;

export const isPushEnabled = () =>
    Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

const configure = () => {
    const key = `${process.env.VAPID_PUBLIC_KEY}:${process.env.VAPID_PRIVATE_KEY}`;
    if (configuredWith === key) return;
    webPush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:admin@example.com",
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
    );
    configuredWith = key;
};

// Sends one notification to every browser the users subscribed from.
// Subscriptions the push service no longer knows (404 or 410) are deleted.
export const sendPushToUsers = async (userIds, payload) => {
    if (!isPushEnabled() || userIds.length === 0) return;
    configure();

    const subscriptions = await PushSubscription.find({ userId: { $in: userIds } }).lean();
    const body = JSON.stringify(payload);

    await Promise.all(
        subscriptions.map(async ({ _id, endpoint, keys }) => {
            try {
                await webPush.sendNotification({ endpoint, keys }, body, { TTL: 60 * 60, urgency: "high" });
            } catch (error) {
                if (error.statusCode === 404 || error.statusCode === 410) {
                    await PushSubscription.deleteOne({ _id });
                } else {
                    console.error("Error sending push notification:", error.message);
                }
            }
        }),
    );
};

const MAX_PREVIEW = 120;

const mediaLabels = {
    image: "Sent a photo",
    video: "Sent a video",
    audio: "Sent a voice message",
    file: "Sent a file",
};

// The notification for a new message. The payload is encrypted for the
// receiving browser, so the push service can't read the preview.
export const messageNotification = ({ conversation, message, sender }) => {
    let text = message.message || mediaLabels[message.mediaType] || "New message";
    if (message.isCall) text = "Call";
    if (text.length > MAX_PREVIEW) text = `${text.slice(0, MAX_PREVIEW - 1)}…`;

    const conversationId = conversation._id.toString();
    return {
        title: conversation.isGroupChat ? conversation.groupName : sender.fullName,
        body: conversation.isGroupChat ? `${sender.fullName}: ${text}` : text,
        icon: sender.profilePic || undefined,
        tag: conversationId,
        conversationId,
        url: `/?chat=${conversationId}`,
    };
};
