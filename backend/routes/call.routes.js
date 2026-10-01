import express from "express";
import { getIceServers } from "../controllers/call.controller.js";
import protectRoute from "../middleware/protectRoute.js";

const router = express.Router();

router.get("/ice-servers", protectRoute, getIceServers);

export default router;
