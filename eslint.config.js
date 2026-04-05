const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/**", ".git/**", ".codex-temp/**"],
  },
  js.configs.recommended,
  {
    files: ["src/renderer/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.test.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: {
        ...globals.node,
        describe: "readonly",
        expect: "readonly",
        it: "readonly",
        vi: "readonly",
      },
    },
  },
  {
    files: ["src/main/**/*.js", "src/shared/**/*.js", "src/automation/**/*.js", "test/**/*.js", "*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "script",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["src/**/*.js"],
    rules: {
      "no-console": "off",
    },
  },
];
