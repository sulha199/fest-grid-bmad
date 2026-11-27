import { nextJsConfig } from "@festgrid/eslint-config/next-js";
import { a11yFiles, a11yIgnores, a11yRules, jsxA11y } from "./eslint-a11y-scope.mjs";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  // Editor feedback only: the shared base loads `eslint-plugin-only-warn`, which turns every error into a warning, so
  // this block cannot fail the build. The enforced pass is `pnpm lint:a11y` (eslint.a11y.config.mjs), part of `lint`.
  {
    files: a11yFiles,
    ignores: a11yIgnores,
    plugins: { "jsx-a11y": jsxA11y },
    languageOptions: jsxA11y.flatConfigs.recommended.languageOptions,
    rules: a11yRules,
  },
];
