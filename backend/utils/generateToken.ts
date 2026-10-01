import jwt from "jsonwebtoken";
import type { Response } from "express";
import type { Types } from "mongoose";
import { requireEnv } from "../config/env.ts";

const generateTokenAndSetCookie = (userId: Types.ObjectId | string, res: Response) => {
    const token = jwt.sign({ userId }, requireEnv("JWT_SECRET"), {
        expiresIn: "15d",
    });

    res.cookie("jwt", token, {
        maxAge: 15 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: process.env.NODE_ENV !== "development" ? "none" : "strict",
        secure: process.env.NODE_ENV !== "development",
    });
};

export default generateTokenAndSetCookie;
