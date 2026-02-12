import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-plugin-prettier";
import eslintComments from "@eslint-community/eslint-plugin-eslint-comments";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([
    globalIgnores(["**/out", "**/dist", "**/*.d.ts", "**/webpack.config.js"]),
    js.configs.recommended,
    ...compat.extends(
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "plugin:@typescript-eslint/strict",
        "prettier",
    ),
    {
        plugins: {
            "@typescript-eslint": typescriptEslint,
            prettier,
            "@eslint-community/eslint-comments": eslintComments,
        },

        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: "module",

            parserOptions: {
                project: "./tsconfig.json",
            },
        },

        rules: {
            "@eslint-community/eslint-comments/disable-enable-pair": ["error", {
                allowWholeFile: false,
            }],

            "@eslint-community/eslint-comments/no-unused-disable": "error",

            "@eslint-community/eslint-comments/require-description": ["error", {
                ignore: [],
            }],

            "prettier/prettier": "error",

            "@typescript-eslint/naming-convention": ["warn", {
                selector: "import",
                format: ["camelCase", "PascalCase"],
            }],

            "@typescript-eslint/no-explicit-any": "error",

            "@typescript-eslint/explicit-function-return-type": ["error", {
                allowExpressions: true,
                allowTypedFunctionExpressions: true,
            }],

            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                ignoreRestSiblings: true,
            }],

            curly: ["warn", "multi-line"],
            eqeqeq: ["error", "always"],
            "no-throw-literal": "error",
            semi: ["error", "always"],

            complexity: ["warn", {
                max: 10,
            }],

            "max-depth": ["warn", {
                max: 4,
            }],

            "max-nested-callbacks": ["warn", {
                max: 3,
            }],

            "max-lines-per-function": ["warn", {
                max: 50,
                skipBlankLines: true,
                skipComments: true,
            }],

            "no-eval": "error",
            "no-implied-eval": "error",
            "no-new-func": "error",

            "no-restricted-properties": ["error", {
                object: "*",
                property: "innerHTML",
                message: "SECURITY: innerHTML is not allowed due to XSS vulnerability risk. Use textContent, createElement, or appendChild instead. See issue #229.",
            }],

            "no-console": "error",
        },
    },
    {
        files: ["src/utils/logger.ts", "src/webview/utils/ManagerLogger.ts"],

        rules: {
            "no-console": "off",
        },
    },
    {
        files: ["src/test/**/*.ts", "src/test/**/*.js"],

        rules: {
            "no-console": "off",

            "@typescript-eslint/no-unused-vars": ["error", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                caughtErrorsIgnorePattern: "^_|^error$|^e$",
                ignoreRestSiblings: true,
            }],
        },
    },
]);
