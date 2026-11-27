| Pair | Theme | Before | After | Change |
|---|---|---|---|---|
| Status badge "Now" | light | 3.76 (`#ffffff` on `#059669`) | 5.48 (`#ffffff` on `#047857`) | `bg-emerald-600` → `bg-emerald-700` (white text stays) |
| Status badge "Upcoming" (default badge, muted pair) | light | 4.34 (`#64748b` on `#f1f5f9`) | 4.54 (`#617187` on `#f1f5f9`) | token `--muted-foreground` (light): lightness 46.9% → 45.5% |
| "This content is no longer available" | light | 2.30 (`#9ca3af` on `#f3f4f6`) | 6.86 (`#4b5563` on `#f3f4f6`) | `text-gray-400` → `text-gray-600 dark:text-gray-400` |
| "Log Out" (`text-destructive` on the popover) | light | 3.78 (`#ef4343` on `#ffffff`) | 5.22 (`#d81313` on `#ffffff`) | token `--destructive` (light): lightness 60% → 46% |
| "Log Out" in its hover state (`hover:bg-muted`) | light | 3.45 (`#ef4343` on `#f1f5f9`) | 4.76 (`#d81313` on `#f1f5f9`) | same token change as above |
| Token pair secondary-foreground / secondary | light | 4.10 (`#f8fafc` on `#666af0`) | 4.53 (`#f8fafc` on `#5d61ef`) | token `--secondary` (light): lightness 67% → 65% |
| Token pair accent-foreground / accent (recommended: darker text) | light | 2.88 (`#f8fafc` on `#ff5c61`) | 5.91 (`#0f172a` on `#ff5c61`) | token `--accent-foreground` (light): `210 40% 98%` → `222.2 47.4% 11.2%` (accent coral unchanged) |
| Token pair accent-foreground / accent (alternative: darker coral) | light | 2.88 (`#f8fafc` on `#ff5c61`) | 4.59 (`#f8fafc` on `#e60008`) | token `--accent` (light): lightness 68% → 45% (coral becomes red) |
| Token pair success-foreground / success (both themes) | light | 2.47 (`#f8fafc` on `#10b77f`) | 4.54 (`#f8fafc` on `#0b835b`) | token `--success` (light and dark): lightness 39% → 28% |
| Token pair destructive-foreground / destructive (button) | light | 3.61 (`#f8fafc` on `#ef4343`) | 4.98 (`#f8fafc` on `#d81313`) | same `--destructive` change as "Log Out" |
| Not measured yet: "Starting soon" badge | light | 4.09 (`#ffffff` on `#0284c7`) | 5.93 (`#ffffff` on `#0369a1`) | `bg-sky-600` → `bg-sky-700` |
| Inactive time filter (Today / Upcoming) | dark | 2.64 (`#4b5563` on `#020817`) | 7.87 (`#9ca3af` on `#020817`) | `text-gray-600` → `text-gray-600 dark:text-gray-400` |
| Inactive time filter, hover state | dark | 2.30 (`#9ca3af` on `#f3f4f6`) | 5.78 (`#9ca3af` on `#1f2937`) | add `dark:hover:bg-gray-800` (the light `hover:bg-gray-100` is also light in the dark theme today) |
| Secondary grey text (account handle, Published date) | dark | 4.13 (`#6b7280` on `#020817`) | 7.87 (`#9ca3af` on `#020817`) | `text-gray-500` → `text-gray-500 dark:text-gray-400` |
| Token wizard-secondary on the page | dark | 4.13 (`#6b7280` on `#020817`) | 4.57 (`#727988` on `#020817`) | token `--wizard-secondary` (dark): lightness 46% → 49% |
| Not measured yet: `text-destructive` on the dark page | dark | 1.99 (`#7f1d1d` on `#020817`) | 7.23 (`#f87171` on `#020817`) | a text-only destructive colour for the dark theme (see "Findings outside the list") |
| Input border vs the page (1.4.11, option 1: darker `--input`) | light | 1.17 (`#e2e8f0` on `#f9fafb`) | 3.17 (`#728fb6` on `#f9fafb`) | token `--input` (light): lightness 91.4% → 58% |
| Input border vs the page (1.4.11, option 1: darker `--input`) | dark | 1.36 (`#1e293b` on `#020817`) | 3.14 (`#46608b` on `#020817`) | token `--input` (dark): lightness 17.5% → 41% |

| Extra check | Ratio |
|---|---|
| muted-foreground (before) on the page background | 4.55 |
| muted-foreground (after) on the page background | 4.76 |
| muted-foreground (after) on white | 4.97 |
| gray-500 on gray-100 (why gray-600 is needed for "no longer available") | 4.39 |
| destructive (after) text on the page background | 4.99 |
| destructive-foreground on destructive/90 hover over white, before | 3.23 |
| destructive-foreground on destructive/90 hover over white, after | 4.53 |
| secondary-foreground on secondary/80 hover over white, before | 2.94 |
| secondary-foreground on secondary/80 hover over white, after | 3.18 |
| dark text on coral accent (recommended option) | 5.91 |
| input border (after) vs white card, light | 3.32 |
| dark destructive token as text on the dark page, before | 1.99 |
| dark destructive-foreground on the dark destructive button (passes today) | 9.57 |
