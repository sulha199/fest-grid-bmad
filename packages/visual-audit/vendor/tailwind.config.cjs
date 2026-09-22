/** Offline Tailwind build config (Story 0.43 review item 9): compiles a static utility-CSS
 * bundle covering every class this package's fixtures/manifests and the design-artifact
 * prototypes actually use, so rendering never depends on reaching cdn.tailwindcss.com. Content
 * globs intentionally cover both this package's own sources and the prototype HTML files it
 * mounts, since both are Tailwind CDN consumers this harness intercepts. */
module.exports = {
  content: [
    'manifests/**/*.{ts,tsx}',
    'src/**/*.{ts,tsx}',
    '*.test.ts',
    'manifests-proof.spec.ts',
    '../../design-artifacts/UX-festgrid-run-1/prototypes/**/*.html',
    // The react-component RenderSpec (Review Follow-up item 1) mounts real @festgrid/ui
    // components, whose own Tailwind classes must be in this offline bundle too.
    '../ui/src/core/count-badge.tsx',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(210 20% 98%)',
        foreground: 'hsl(221 39% 11%)',
        card: 'hsl(0 0% 100%)',
        primary: 'hsl(217 33% 17%)',
        secondary: 'hsl(238 82% 67%)',
        'secondary-foreground': 'hsl(210 40% 98%)',
        muted: 'hsl(210 40% 96.1%)',
        'muted-foreground': 'hsl(215.4 16.3% 46.9%)',
        // Matches apps/web/src/app/globals.css's light-mode shadcn tokens -- needed by the
        // react-component mount example (CountBadge uses bg-destructive/text-destructive-foreground).
        destructive: 'hsl(0 84% 60%)',
        'destructive-foreground': 'hsl(210 40% 98%)',
      },
    },
  },
  // Safety net for colors referenced only indirectly (e.g. via a variable) -- the arbitrary
  // bracket-value utilities (w-[175px], text-[11px], etc.) are already picked up directly by
  // content scanning since this package's fixtures spell them out as literal strings.
  safelist: [{ pattern: /^bg-(slate|emerald|amber|rose)-(50|100|200|600|700|800)$/ }],
};
