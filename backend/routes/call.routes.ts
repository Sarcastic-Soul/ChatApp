import express from "express";
import { getIceServers } from "../controllers/call.controller.ts";
import protectRoute from "../middleware/protectRoute.ts";

const router = express.Router();

router.get("/ice-servers", protectRoute, getIceServers);

export default router;
