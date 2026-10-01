import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.{js,jsx}"],
        // Gives the IndexedDB cache a working database outside the browser
        setupFiles: ["fake-indexeddb/auto"],
    },
});
