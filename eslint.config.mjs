import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    {
        files: ["**/*.{ts}"]
    },
    {
        languageOptions: {
            globals: globals.node
        }
    },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            'no-var': 'off',
            'eqeqeq': 'error',
            "@typescript-eslint/no-require-imports": 'off'
        },
    },
    {
        ignores: ["**/*.js"]
    }
];
