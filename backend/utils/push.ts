import webPush from "web-push";
import type { Types } from "mongoose";
import PushSubscription from "../models/pushSubscription.model.ts";
import { requireEnv } from "../config/env.ts";
import { errorMessage } from "./errorMessage.ts";

// Web Push needs a VAPID key pair (npx web-push generate-vapid-keys) and a
// contact address for the push services. Without them, push is off and
// sendPushToUsers does nothing.
let configuredWith: string | null = null;

export const isPushEnabled = () =>
    Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

const configure = () => {
    const key = `${process.env.VAPID_PUBLIC_KEY}:${process.env.VAPID_PRIVATE_KEY}`;
    if (configuredWith === key) return;
    webPush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:admin@example.com",
        requireEnv("VAPID_PUBLIC_KEY"),
        requireEnv("VAPID_PRIVATE_KEY"),
    );
    configuredWith = key;
};

// Sends one notification to every browser the users subscribed from.
// Subscriptions the push service no longer knows (404 or 410) are deleted.
export type PushPayload = {
    title: string;
    body: string;
    icon?: string;
    tag: string;
    conversationId: string;
    url: string;
};

export const sendPushToUsers = async (userIds: Types.ObjectId[], payload: PushPayload) => {
    if (!isPushEnabled() || userIds.length === 0) return;
    configure();

    const subscriptions = await PushSubscription.find({ userId: { $in: userIds } }).lean();
    const body = JSON.stringify(payload);

    await Promise.all(
        subscriptions.map(async ({ _id, endpoint, keys }) => {
            if (!keys) return;
            try {
                await webPush.sendNotification({ endpoint, keys }, body, { TTL: 60 * 60, urgency: "high" });
            } catch (error) {
                const status = (error as { statusCode?: number }).statusCode;
                if (status === 404 || status === 410) {
                    await PushSubscription.deleteOne({ _id });
                } else {
                    console.error("Error sending push notification:", errorMessage(error));
                }
            }
        }),
    );
};

const MAX_PREVIEW = 120;

const mediaLabels: Record<string, string> = {
    image: "Sent a photo",
    video: "Sent a video",
    audio: "Sent a voice message",
    file: "Sent a file",
};

// The notification for a new message. The payload is encrypted for the
// receiving browser, so the push service can't read the preview.
type NotificationInput = {
    conversation: { _id: Types.ObjectId; isGroupChat?: boolean | null; groupName?: string | null };
    message: { message?: string | null; mediaType?: string | null; isCall?: boolean | null };
    sender: { fullName: string; profilePic?: string | null };
};

export const messageNotification = ({ conversation, message, sender }: NotificationInput): PushPayload => {
    let text = message.message || mediaLabels[message.mediaType ?? ""] || "New message";
    if (message.isCall) text = "Call";
    if (text.length > MAX_PREVIEW) text = `${text.slice(0, MAX_PREVIEW - 1)}…`;

    const conversationId = conversation._id.toString();
    return {
        title: (conversation.isGroupChat && conversation.groupName) || sender.fullName,
        body: conversation.isGroupChat ? `${sender.fullName}: ${text}` : text,
        icon: sender.profilePic || undefined,
        tag: conversationId,
        conversationId,
        url: `/?chat=${conversationId}`,
    };
};
