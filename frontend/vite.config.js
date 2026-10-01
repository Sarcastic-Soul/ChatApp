import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const vendorGroups = [
    { name: "react", test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
    { name: "mantine", test: /node_modules[\\/]@mantine[\\/]/ },
    { name: "ui", test: /node_modules[\\/]emoji-picker-react[\\/]/ },
    { name: "socket", test: /node_modules[\\/](socket\.io-client|engine\.io-client|socket\.io-parser|engine\.io-parser)[\\/]/ },
];

export default defineConfig(({ mode }) => {
    const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };

    return {
        plugins: [react()],
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
