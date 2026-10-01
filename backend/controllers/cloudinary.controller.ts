import type { Request, Response } from "express";
import cloudinary from "../utils/cloudinary.ts";
import { requireEnv } from "../config/env.ts";
import { errorMessage } from "../utils/errorMessage.ts";

// Signs a direct browser upload into one Cloudinary folder, so the API
// secret never leaves the server
const signUploadTo = (folder: string, label: string) => (_req: Request, res: Response) => {
    try {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const signature = cloudinary.utils.api_sign_request(
            { timestamp, folder },
            requireEnv("CLOUDINARY_API_SECRET"),
        );

        res.status(200).json({
            signature,
            timestamp,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            folder,
        });
    } catch (error) {
        console.error(`Error generating ${label} signature:`, errorMessage(error));
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getMediaCloudinarySignature = signUploadTo("MERN-ChatApp/chat_app_media", "Cloudinary");
export const getProfilePicSignature = signUploadTo("MERN-ChatApp/profile_pic", "Profile Pic");
export const getGroupIconSignature = signUploadTo("MERN-ChatApp/group_icons", "Group Icon");
