// Origins allowed to call the API and open a socket. Extra origins can be
// added with a comma-separated CLIENT_ORIGINS env var.
const defaultOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://socket-chat-nine-tau.vercel.app",
];

const extraOrigins = (process.env.CLIENT_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

export const allowedOrigins = [...defaultOrigins, ...extraOrigins];
