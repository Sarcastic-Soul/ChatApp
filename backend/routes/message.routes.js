import express from "express";
import {
    getMessages,
    sendMessage,
    addReaction,
    markMessagesAsRead,
    generateMagicReply,
    editMessage,
    deleteMessage,
} from "../controllers/message.controller.js";
import protectRoute from "../middleware/protectRoute.js";
import { messageRateLimiter } from "../middleware/rateLimiter.js";
import validate from "../middleware/validate.js";
import {
    conversationIdSchema,
    editMessageSchema,
    getMessagesSchema,
    magicReplySchema,
    messageIdSchema,
    reactionSchema,
    sendMessageSchema,
} from "../validation/schemas.js";

const router = express.Router();

router.get("/:id", protectRoute, validate(getMessagesSchema), getMessages);
router.post("/send/:id", protectRoute, messageRateLimiter, validate(sendMessageSchema), sendMessage);
router.post("/react/:messageId", protectRoute, validate(reactionSchema), addReaction);
router.post("/read/:id", protectRoute, validate(conversationIdSchema), markMessagesAsRead);
router.post("/magic-reply", protectRoute, messageRateLimiter, validate(magicReplySchema), generateMagicReply);
router.put("/edit/:messageId", protectRoute, messageRateLimiter, validate(editMessageSchema), editMessage);
router.delete("/delete/:messageId", protectRoute, messageRateLimiter, validate(messageIdSchema), deleteMessage);

export default router;
