import type { MetadataRoute } from 'next'

// Story 0.38 (AC8, AC9) — Next.js App Router's built-in manifest file
// convention: auto-served at `/manifest.webmanifest` and auto-linked into
// every page's `<head>`. A single, locale-agnostic manifest is a deliberate,
// proportionate choice (AC9) — most real-world PWAs do not localize
// `name`/`short_name`.
//
// `theme_color`/`background_color` are DESIGN.md's own documented brand
// palette (`colors.primary` / `colors.neutral`) — not invented hex values.
// The icons are real, checked-in PNGs (Task 3.1) rasterized from
// `packages/ui/src/core/app-shell/LogoMark.tsx`.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FestDaily',
    short_name: 'FestDaily',
    description: 'Discover, track, and get reminded about music festivals and live events.',
    start_url: '/',
    display: 'standalone',
    theme_color: '#1E293B',
    background_color: '#FAFAFC',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
