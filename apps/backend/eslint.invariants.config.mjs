import {
  AD8_NO_HAND_WRITTEN_SOFT_DELETE_FILTER,
  invariantsConfig,
} from "@festgrid/eslint-config/invariants";

// The enforced pass of `pnpm lint` (`lint:invariants`). `eslint.config.mjs` extends the shared base,
// whose `only-warn` plugin turns every error into a warning, so the Architecture Spine rules that
// must break the build are declared here instead. See packages/eslint-config/invariants.js.
export default invariantsConfig({
  files: ["src/**/*.ts"],
  ignores: ["dist/", "src/generated/"],
  rules: {
    // AD-8 rule 2: active rows are read through activeOnly(table), never a hand-written isNull(table.deletedAt).
    "no-restricted-syntax": ["error", AD8_NO_HAND_WRITTEN_SOFT_DELETE_FILTER],
  },
});
