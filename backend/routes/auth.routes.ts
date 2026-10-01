import express from "express";
import { getMe, getSocketToken, login, logout, signup } from "../controllers/auth.controller.ts";
import protectRoute from "../middleware/protectRoute.ts";
import validate from "../middleware/validate.ts";
import { loginSchema, signupSchema } from "../validation/schemas.ts";

const router = express.Router();

router.post("/signup", validate(signupSchema), signup);
router.post("/login", validate(loginSchema), login);
router.post("/logout", logout);
router.get("/me", protectRoute, getMe);
router.get("/socket-token", protectRoute, getSocketToken);

export default router;
