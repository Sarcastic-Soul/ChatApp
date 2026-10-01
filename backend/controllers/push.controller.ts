import type { Request, Response } from "express";
import PushSubscription from "../models/pushSubscription.model.ts";
import { isPushEnabled } from "../utils/push.ts";
import { errorMessage } from "../utils/errorMessage.ts";
import type { ValidatedRequest } from "../middleware/validate.ts";
import type { pushSubscribeSchema, pushUnsubscribeSchema } from "../validation/schemas.ts";

export const getPushPublicKey = (_req: Request, res: Response) => {
    if (!isPushEnabled()) {
        return res.status(404).json({ error: "Push notifications are not set up" });
    }
    res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

export const subscribe = async (req: ValidatedRequest<typeof pushSubscribeSchema>, res: Response) => {
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
        console.error("Error in subscribe controller:", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const unsubscribe = async (req: ValidatedRequest<typeof pushUnsubscribeSchema>, res: Response) => {
    try {
        await PushSubscription.deleteOne({ endpoint: req.body.endpoint, userId: req.user._id });
        res.status(200).json({ subscribed: false });
    } catch (error) {
        console.error("Error in unsubscribe controller:", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};
