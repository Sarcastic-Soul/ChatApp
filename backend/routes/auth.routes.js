import express from "express";
import { getMe, getSocketToken, login, logout, signup } from "../controllers/auth.controller.js";
import protectRoute from "../middleware/protectRoute.js";
import validate from "../middleware/validate.js";
import { loginSchema, signupSchema } from "../validation/schemas.js";

const router = express.Router();

router.post("/signup", validate(signupSchema), signup);
router.post("/login", validate(loginSchema), login);
router.post("/logout", logout);
router.get("/me", protectRoute, getMe);
router.get("/socket-token", protectRoute, getSocketToken);

export default router;
