import jwt, { type JwtPayload } from "jsonwebtoken";
import type { RequestHandler } from "express";
import User from "../models/user.model.ts";
import { requireEnv } from "../config/env.ts";
import { errorMessage } from "../utils/errorMessage.ts";

// Typed loosely so it can sit in front of handlers with typed params,
// query and body
const protectRoute: RequestHandler<any, any, any, any> = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;

        if (!token) {
            return res
                .status(401)
                .json({ error: "Unauthorized - No Token Provided" });
        }

        let decoded: JwtPayload;
        try {
            decoded = jwt.verify(token, requireEnv("JWT_SECRET")) as JwtPayload;
        } catch {
            return res
                .status(401)
                .json({ error: "Unauthorized - Invalid Token" });
        }

        // Socket tokens are only for the socket handshake
        if (decoded.scope) {
            return res
                .status(401)
                .json({ error: "Unauthorized - Invalid Token" });
        }

        const user = await User.findById(decoded.userId).select("-password");

        if (!user) {
            return res.status(401).json({ error: "Unauthorized - User not found" });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Error in protectRoute middleware: ", errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export default protectRoute;
