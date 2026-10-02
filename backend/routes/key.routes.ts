import express from "express";
import { getChatKeys, getMyKey, setMyKey } from "../controllers/key.controller.ts";
import protectRoute from "../middleware/protectRoute.ts";
import validate from "../middleware/validate.ts";
import { chatKeysSchema, setMyKeySchema } from "../validation/schemas.ts";

const router = express.Router();

router.get("/me", protectRoute, getMyKey);
router.put("/me", protectRoute, validate(setMyKeySchema), setMyKey);
router.get("/chats/:id", protectRoute, validate(chatKeysSchema), getChatKeys);

export default router;
