import { config as baseConfig } from "@festgrid/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...baseConfig,
  {
    ignores: ["dist/", "src/generated/"],
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='isNull'] Identifier[name='deletedAt']",
          message:
            "Do not hand-write isNull(table.deletedAt) — import activeOnly(table) from '@festgrid/graphql-select' instead (AD-8 rule 2).",
        },
      ],
    },
  },
];
