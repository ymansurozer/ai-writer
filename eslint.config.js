import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
  },
  {
    languageOptions: { globals: globals.node },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "indent": ["error", 2],
      "quotes": ["error", "double"],

      "comma-style": ["error", "last"],
      "comma-spacing": ["error", {
        "before": false,
        "after": true,
      }],
      "no-multi-spaces": "error",

      "semi-spacing": ["error", {
        "before": false,
        "after": true,
      }],
      "semi": ["error", "always"],
      "semi-style": ["error", "last"],

      "no-multiple-empty-lines": ["error", {
        "max": 1,
        "maxEOF": 1,
        "maxBOF": 0,
      }],
      "padding-line-between-statements": [
        "error",
        { "blankLine": "always", "prev": "*", "next": "return" },
      ],

      "curly": ["error", "multi-or-nest"],
      "comma-dangle": ["error", "always-multiline"],
      "no-trailing-spaces": "error",
      "eol-last": "error",
    },
  },
];
