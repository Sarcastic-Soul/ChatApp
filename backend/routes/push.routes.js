import express from "express";
import { getPushPublicKey, subscribe, unsubscribe } from "../controllers/push.controller.js";
import protectRoute from "../middleware/protectRoute.js";
import validate from "../middleware/validate.js";
import { pushSubscribeSchema, pushUnsubscribeSchema } from "../validation/schemas.js";

const router = express.Router();

router.get("/public-key", getPushPublicKey);
router.post("/subscribe", protectRoute, validate(pushSubscribeSchema), subscribe);
router.post("/unsubscribe", protectRoute, validate(pushUnsubscribeSchema), unsubscribe);

export default router;
