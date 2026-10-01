import express from "express";
import protectRoute from "../middleware/protectRoute.ts";
import validate from "../middleware/validate.ts";
import {
    getUserByUsername,
    getConversations,
    getUsersForSidebar,
    updateUserProfilePic,
    getUsersForNewChat,
    updatePrivacy,
} from "../controllers/user.controller.ts";
import { privacySchema, profilePicSchema, usernameSchema } from "../validation/schemas.ts";

const router = express.Router();

router.get("/", protectRoute, getUsersForSidebar);
router.get("/new", protectRoute, getUsersForNewChat);
router.get("/conversations", protectRoute, getConversations);
router.put("/update-pic", protectRoute, validate(profilePicSchema), updateUserProfilePic);
router.put("/privacy", protectRoute, validate(privacySchema), updatePrivacy);
router.get("/:username", protectRoute, validate(usernameSchema), getUserByUsername);

export default router;
