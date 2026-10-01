import "dotenv/config";
import path from "path";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";

// ✅ Import your routes
import authRoutes from "./routes/auth.routes.js";
import messageRoutes from "./routes/message.routes.js";
import userRoutes from "./routes/user.routes.js";
import groupRoutes from "./routes/group.routes.js";
import cloudinaryRoutes from "./routes/cloudinary.routes.js";

import connectToMongoDB from "./db/connectToMongoDB.js";
import { app, server } from "./socket/socket.js";
import { allowedOrigins } from "./config/allowedOrigins.js";

const __dirname = path.resolve();
const PORT = process.env.PORT || 5000;

// ✅ Clean CORS setup
app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    }),
);

// ✅ Middlewares
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// ✅ API Routes (CRITICAL: Do not remove these)
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/cloudinary", cloudinaryRoutes);

// ✅ Health Check Route (Prevents Render Sleep)
app.get("/healthz", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// ✅ Production static serving
if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "/frontend/dist")));

    app.get(/.*/, (req, res) => {
        res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
    });
}

// ✅ Start server
server.listen(PORT, () => {
    connectToMongoDB();
    console.log(`Server running on port ${PORT}`);
});
