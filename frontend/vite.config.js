import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const vendorGroups = [
    { name: "react", test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
    { name: "mantine", test: /node_modules[\\/]@mantine[\\/]/ },
    { name: "ui", test: /node_modules[\\/]emoji-picker-react[\\/]/ },
    { name: "socket", test: /node_modules[\\/](socket\.io-client|engine\.io-client|socket\.io-parser|engine\.io-parser)[\\/]/ },
];

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
    },
    build: {
        rolldownOptions: {
            output: {
                codeSplitting: { groups: vendorGroups },
            },
        },
    },
});
