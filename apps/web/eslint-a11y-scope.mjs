import jsxA11y from "eslint-plugin-jsx-a11y";

// The surfaces `apps/web` owns under the WCAG 2.2 AA commitment (project-context.md "Accessibility", rule 8):
// the navbar wrapper, the event list and event detail features (including the report and correction dialogs),
// and the pages that render event cards. A surface joins this list when it joins the commitment. Tests are excluded.
// (`[[]` is the glob escape for a literal `[`, as the folder is named `[locale]`.)
export const a11yFiles = [
  "src/components/layout/**/*.{ts,tsx}",
  "src/features/events/**/*.{ts,tsx}",
  "src/app/[[]locale]/home-content.tsx",
  "src/app/[[]locale]/favorites/favorites-content.tsx",
  "src/app/[[]locale]/feed/feed-content.tsx",
];
export const a11yIgnores = ["**/*.test.{ts,tsx}"];

const isOff = (setting) => {
  const level = Array.isArray(setting) ? setting[0] : setting;
  return level === "off" || level === 0;
};

/** The jsx-a11y recommended rules: every rule the preset turns on is raised to `error`; rules it turns off stay off. */
export const a11yRules = Object.fromEntries(
  Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([name, setting]) => [
    name,
    isOff(setting) ? "off" : Array.isArray(setting) ? ["error", ...setting.slice(1)] : "error",
  ]),
);

export { jsxA11y };
