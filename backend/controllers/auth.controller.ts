import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import User from "../models/user.model.ts";
import generateTokenAndSetCookie from "../utils/generateToken.ts";
import { requireEnv } from "../config/env.ts";
import { errorMessage } from "../utils/errorMessage.ts";
import type { ValidatedRequest } from "../middleware/validate.ts";
import type { loginSchema, signupSchema } from "../validation/schemas.ts";

export const signup = async (req: ValidatedRequest<typeof signupSchema>, res: Response) => {
    try {
        // Checked by signupSchema
        const { fullName, username, password } = req.body;

        const user = await User.findOne({ username });

        if (user) {
            return res.status(400).json({ error: "Username already exists" });
        }

        // HASH PASSWORD HERE
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const profilePicURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&bold=true`;

        const newUser = new User({
            fullName,
            username,
            password: hashedPassword,
            profilePic: profilePicURL,
        });

        if (newUser) {
            // Generate JWT token here
            generateTokenAndSetCookie(newUser._id, res);
            await newUser.save();

            res.status(201).json({
                _id: newUser._id,
                fullName: newUser.fullName,
                username: newUser.username,
                profilePic: newUser.profilePic,
                isPublic: newUser.isPublic,
            });
        } else {
            res.status(400).json({ error: "Invalid user data" });
        }
    } catch (error) {
        console.error("Error in signup controller", errorMessage(error));
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const login = async (req: ValidatedRequest<typeof loginSchema>, res: Response) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        const isPasswordCorrect = await bcrypt.compare(
            password,
            user?.password || "",
        );

        if (!user || !isPasswordCorrect) {
            return res
                .status(400)
                .json({ error: "Invalid username or password" });
        }

        generateTokenAndSetCookie(user._id, res);

        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            username: user.username,
            profilePic: user.profilePic,
            isPublic: user.isPublic,
        });
    } catch (error) {
        console.error("Error in login controller", errorMessage(error));
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const logout = (_req: Request, res: Response) => {
    try {
        res.cookie("jwt", "", {
            maxAge: 0,
            httpOnly: true,
            sameSite:
                process.env.NODE_ENV !== "development" ? "none" : "strict",
            secure: process.env.NODE_ENV !== "development",
        });
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        console.error("Error in logout controller", errorMessage(error));
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Returns the logged-in user, so the client can check its session is valid
export const getMe = (req: Request, res: Response) => {
    const { _id, fullName, username, profilePic, isPublic } = req.user;
    res.status(200).json({ _id, fullName, username, profilePic, isPublic });
};

// Short-lived token the client sends when opening a socket. The socket server
// is on another domain from the site, so it cannot read the auth cookie.
export const getSocketToken = (req: Request, res: Response) => {
    const token = jwt.sign(
        { userId: req.user._id, scope: "socket" },
        requireEnv("JWT_SECRET"),
        { expiresIn: "5m" },
    );
    res.status(200).json({ token });
};
