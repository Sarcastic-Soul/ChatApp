import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";

// Routes
import authRoutes from "./routes/auth.routes.js";
import messageRoutes from "./routes/message.routes.js";
import userRoutes from "./routes/user.routes.js";
import groupRoutes from "./routes/group.routes.js";
import cloudinaryRoutes from "./routes/cloudinary.routes.js";
import callRoutes from "./routes/call.routes.js";
import pushRoutes from "./routes/push.routes.js";

import { app, io, server } from "./socket/socket.js";
import { allowedOrigins } from "./config/allowedOrigins.js";

// The Express app with every route attached. server.js starts it; tests
// import it without opening a port or a database connection.

// CORS
app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    }),
);

// Middleware
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/cloudinary", cloudinaryRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/push", pushRoutes);

// Health check, also pinged to keep Render awake
app.get("/healthz", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// The frontend is served by Vercel, so anything else here is a 404
app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
});

export { app, io, server };
