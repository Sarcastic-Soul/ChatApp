import express from "express";
import { getPushPublicKey, subscribe, unsubscribe } from "../controllers/push.controller.ts";
import protectRoute from "../middleware/protectRoute.ts";
import validate from "../middleware/validate.ts";
import { pushSubscribeSchema, pushUnsubscribeSchema } from "../validation/schemas.ts";

const router = express.Router();

router.get("/public-key", getPushPublicKey);
router.post("/subscribe", protectRoute, validate(pushSubscribeSchema), subscribe);
router.post("/unsubscribe", protectRoute, validate(pushUnsubscribeSchema), unsubscribe);

export default router;
