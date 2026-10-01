import PushSubscription from "../models/pushSubscription.model.js";
import { isPushEnabled } from "../utils/push.js";

export const getPushPublicKey = (req, res) => {
    if (!isPushEnabled()) {
        return res.status(404).json({ error: "Push notifications are not set up" });
    }
    res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

export const subscribe = async (req, res) => {
    try {
        const { endpoint, keys } = req.body;
        // The same browser may have been used by someone else before, so the
        // subscription moves to whoever is logged in now
        await PushSubscription.findOneAndUpdate(
            { endpoint },
            { userId: req.user._id, endpoint, keys },
            { upsert: true },
        );
        res.status(201).json({ subscribed: true });
    } catch (error) {
        console.error("Error in subscribe controller:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};

export const unsubscribe = async (req, res) => {
    try {
        await PushSubscription.deleteOne({ endpoint: req.body.endpoint, userId: req.user._id });
        res.status(200).json({ subscribed: false });
    } catch (error) {
        console.error("Error in unsubscribe controller:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
};
