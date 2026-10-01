import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        include: ["src/**/*.test.{js,jsx}"],
        // jsdom for components, fake-indexeddb for the message cache
        setupFiles: ["./src/test/setup.js"],
    },
});
