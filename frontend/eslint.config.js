import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
    { ignores: ["dist"] },
    js.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
    {
        files: ["**/*.{js,jsx}"],
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
        files: ["vite.config.js", "vitest.config.js", "eslint.config.js"],
        languageOptions: { globals: globals.node },
    },
];
