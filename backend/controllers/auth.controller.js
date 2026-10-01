import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import generateTokenAndSetCookie from "../utils/generateToken.js";

export const signup = async (req, res) => {
    try {
        const { fullName, username, password, confirmPassword, gender } =
            req.body;

        if (password !== confirmPassword) {
            return res.status(400).json({ error: "Passwords don't match" });
        }

        const user = await User.findOne({ username });

        if (user) {
            return res.status(400).json({ error: "Username already exists" });
        }

        // HASH PASSWORD HERE
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const profilePicURL = `https://ui-avatars.com/api/?name=${fullName}&background=random&bold=true`;

        const newUser = new User({
            fullName,
            username,
            password: hashedPassword,
            gender,
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
        console.error("Error in signup controller", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const login = async (req, res) => {
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
        console.error("Error in login controller", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

export const logout = (req, res) => {
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
        console.error("Error in logout controller", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Returns the logged-in user, so the client can check its session is valid
export const getMe = (req, res) => {
    const { _id, fullName, username, profilePic, isPublic } = req.user;
    res.status(200).json({ _id, fullName, username, profilePic, isPublic });
};

// Short-lived token the client sends when opening a socket. The socket server
// is on another domain from the site, so it cannot read the auth cookie.
export const getSocketToken = (req, res) => {
    const token = jwt.sign(
        { userId: req.user._id, scope: "socket" },
        process.env.JWT_SECRET,
        { expiresIn: "5m" },
    );
    res.status(200).json({ token });
};
