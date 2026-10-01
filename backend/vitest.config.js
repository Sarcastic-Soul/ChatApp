import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        globalSetup: ["./tests/setup/mongoServer.js"],
        setupFiles: ["./tests/setup/database.js"],
        // Fake values only. The real ones live in Render, never in tests.
        env: {
            NODE_ENV: "development",
            JWT_SECRET: "test-jwt-secret",
            ENCRYPTION_KEY: "test-encryption-key",
            GROQ_API_KEY: "test-groq-key",
            CLOUDINARY_CLOUD_NAME: "test-cloud",
            CLOUDINARY_API_KEY: "123456789",
            CLOUDINARY_API_SECRET: "test-cloudinary-secret",
        },
        coverage: {
            include: ["app.js", "config/**", "controllers/**", "middleware/**", "models/**", "routes/**", "socket/**", "utils/**", "validation/**"],
            reporter: ["text", "text-summary"],
        },
        testTimeout: 15000,
        hookTimeout: 60000,
    },
});
