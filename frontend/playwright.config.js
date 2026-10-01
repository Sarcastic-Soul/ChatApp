import { defineConfig, devices } from "@playwright/test";

// Ports apart from the usual dev ones, so a running dev server doesn't clash
const API_PORT = 5050;
const APP_PORT = 3100;
// 127.0.0.1 rather than localhost, which can resolve to more than one address
const HOST = "127.0.0.1";

export default defineConfig({
    testDir: "./e2e",
    timeout: 60_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: `http://${HOST}:${APP_PORT}`,
        trace: "retain-on-failure",
        ...devices["Desktop Chrome"],
    },
    webServer: [
        {
            command: "node ../backend/scripts/e2e-server.js",
            url: `http://${HOST}:${API_PORT}/healthz`,
            timeout: 120_000,
            stdout: "ignore",
            env: {
                PORT: String(API_PORT),
                NODE_ENV: "development",
                JWT_SECRET: "e2e-jwt-secret",
                ENCRYPTION_KEY: "e2e-encryption-key",
                CLOUDINARY_CLOUD_NAME: "e2e-cloud",
                CLOUDINARY_API_KEY: "123",
                CLOUDINARY_API_SECRET: "e2e-cloudinary-secret",
                CLIENT_ORIGINS: `http://${HOST}:${APP_PORT}`,
            },
        },
        {
            command: `pnpm exec vite --host ${HOST} --port ${APP_PORT} --strictPort`,
            url: `http://${HOST}:${APP_PORT}`,
            timeout: 60_000,
            env: { VITE_API_URL: `http://${HOST}:${API_PORT}` },
        },
    ],
});
