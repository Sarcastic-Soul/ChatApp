import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";

// Routes
import authRoutes from "./routes/auth.routes.ts";
import messageRoutes from "./routes/message.routes.ts";
import userRoutes from "./routes/user.routes.ts";
import groupRoutes from "./routes/group.routes.ts";
import cloudinaryRoutes from "./routes/cloudinary.routes.ts";
import callRoutes from "./routes/call.routes.ts";
import pushRoutes from "./routes/push.routes.ts";
import keyRoutes from "./routes/key.routes.ts";

import { app, io, server } from "./socket/socket.ts";
import { allowedOrigins } from "./config/allowedOrigins.ts";

// The Express app with every route attached. server.ts starts it; tests
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
app.use("/api/keys", keyRoutes);

// Health check, also pinged to keep Render awake
app.get("/healthz", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Someone opening the server's own address gets pointed to the app
app.get("/", (req, res) => {
    res.status(200).json({
        name: "ChatApp API",
        status: "ok",
        app: "https://chatapp-e2e.vercel.app",
        docs: "https://chatapp-e2e.vercel.app/docs/",
    });
});

// The frontend is served by Vercel, so anything else here is a 404
app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
});

export { app, io, server };
