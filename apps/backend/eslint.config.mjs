import { config as baseConfig } from "@festgrid/eslint-config/base";
import { AD8_NO_HAND_WRITTEN_SOFT_DELETE_FILTER } from "@festgrid/eslint-config/invariants";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    ignores: ["dist/", "src/generated/"],
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      // Editor feedback only: the base config's `only-warn` plugin downgrades this to a warning, so it
      // cannot fail a build. The enforced copy lives in eslint.invariants.config.mjs (`lint:invariants`).
      "no-restricted-syntax": ["error", AD8_NO_HAND_WRITTEN_SOFT_DELETE_FILTER],
    },
  },
];
