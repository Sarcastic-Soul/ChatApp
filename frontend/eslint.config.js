import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// typescript-eslint's recommended rules, limited to the app's .ts and .tsx
// files. The config files and e2e tests stay JavaScript.
const typescriptRules = tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
}));

export default [
    { ignores: ["dist"] },
    js.configs.recommended,
    ...typescriptRules,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
    {
        files: ["**/*.{js,jsx,ts,tsx}"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: globals.browser,
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
        rules: {
            "no-unused-vars": ["warn", { varsIgnorePattern: "^[A-Z_]", caughtErrors: "none" }],
            // React Compiler rules flag the existing fetch-in-effect pattern.
            // Kept as warnings so they show up without blocking.
            "react-hooks/set-state-in-effect": "warn",
            "react-hooks/immutability": "warn",
            "react-refresh/only-export-components": "warn",
        },
    },
    {
        files: ["**/*.{ts,tsx}"],
        rules: {
            // The TypeScript version understands types and overloads
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^[A-Z_]", caughtErrors: "none" }],
        },
    },
    {
        files: ["vite.config.js", "vitest.config.js", "playwright.config.js", "eslint.config.js", "e2e/**"],
        languageOptions: { globals: globals.node },
    },
];
