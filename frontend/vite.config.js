import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const vendorGroups = [
    { name: "react", test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
    { name: "motion", test: /node_modules[\\/](motion|framer-motion|motion-dom|motion-utils)[\\/]/ },
    { name: "mantine", test: /node_modules[\\/]@mantine[\\/]/ },
    { name: "emoji", test: /node_modules[\\/]emoji-picker-react[\\/]/ },
    { name: "socket", test: /node_modules[\\/](socket\.io-client|engine\.io-client|socket\.io-parser|engine\.io-parser)[\\/]/ },
];

// The API reference is a plain page in public/docs. Vercel and nginx serve a
// folder's index.html on their own; the dev server needs to be told.
const docsPage = {
    name: "docs-page",
    configureServer(server) {
        server.middlewares.use((req, _res, next) => {
            if (req.url === "/docs" || req.url === "/docs/") req.url = "/docs/index.html";
            next();
        });
    },
};

export default defineConfig(({ mode }) => {
    const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };

    return {
        plugins: [react(), docsPage],
        server: {
            port: 3000,
            // REST calls use same-origin /api paths. In dev they are proxied to
            // the backend; in production vercel.json rewrites them to Render.
            proxy: {
                "/api": {
                    target: env.VITE_API_URL || "http://localhost:5000",
                    changeOrigin: true,
                },
            },
        },
        build: {
            rolldownOptions: {
                output: {
                    codeSplitting: { groups: vendorGroups },
                },
            },
        },
    };
});
