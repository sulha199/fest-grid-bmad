# Page-overflow audit -- 2026-10-23

Base URL: `http://localhost:3000`. Metric: `documentElement.scrollWidth - clientWidth` (px the page is wider than the viewport).

## Summary

- Routes swept: 17 × 9 viewports = 153 checks
- Overflowing: 85 checks across 17 route(s)
- Errors (page not measured): 0
- Skipped routes: 1

## Matrix

| Route | 320px | 360px | 375px | 390px | 412px | 768px | 1024px | 1280px | 1440px |
|---|---|---|---|---|---|---|---|---|---|
| `/en` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/login` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/feed` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/archive` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/my-calendar` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/favorites` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/reports` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/votes` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/posts/select` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/settings/account` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/settings/locations` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/settings/widgets` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/settings/ai-filters` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/moderator/items` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/moderator/tools` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/test-swipe` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |
| `/en/events/ongoing-culture-fest-2026-2027-fixed` | +193px | +153px | +138px | +123px | +101px | ok | ok | ok | ok |

## Distinct culprits

### C1 -- `div.min-h-screen.flex.flex-col > main.flex-1.flex.flex-col > div.w-full.flex.items-center > div.flex.items-center.gap-2`

- Seen on 17 route(s) at 320, 360, 375, 390, 412px; worst overshoot +193.1px; element width 429px
- Classes: `flex items-center gap-2 shrink-0`
- Routes: `/en`, `/en/login`, `/en/feed`, `/en/archive`, `/en/my-calendar`, `/en/favorites`, `/en/reports`, `/en/votes`, `/en/posts/select`, `/en/settings/account`, `/en/settings/locations`, `/en/settings/widgets`, `/en/settings/ai-filters`, `/en/moderator/items`, `/en/moderator/tools`, `/en/test-swipe`, `/en/events/ongoing-culture-fest-2026-2027-fixed`

## Findings by route

### `/en`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/login`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/feed`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/archive`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/my-calendar`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/favorites`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/reports`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/votes`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/posts/select`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/settings/account`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/settings/locations`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/settings/widgets`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/settings/ai-filters`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/moderator/items`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/moderator/tools`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/test-swipe`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

### `/en/events/ongoing-culture-fest-2026-2027-fixed`

- **320px** +193px (scrollWidth 513 vs clientWidth 320) -> C1
- **360px** +153px (scrollWidth 513 vs clientWidth 360) -> C1
- **375px** +138px (scrollWidth 513 vs clientWidth 375) -> C1
- **390px** +123px (scrollWidth 513 vs clientWidth 390) -> C1
- **412px** +101px (scrollWidth 513 vs clientWidth 412) -> C1

## Caveats

- `/en/feed` shows the login prompt when signed out, so the audited UI is the login screen inside the real app shell, not the page itself.
- `/en/archive` shows the login prompt when signed out, so the audited UI is the login screen inside the real app shell, not the page itself.
- `/en/my-calendar` shows the login prompt when signed out, so the audited UI is the login screen inside the real app shell, not the page itself.
- `/en/favorites` shows the login prompt when signed out, so the audited UI is the login screen inside the real app shell, not the page itself.
- `/en/reports` shows the login prompt when signed out, so the audited UI is the login screen inside the real app shell, not the page itself.
- `/en/posts/select` shows the login prompt when signed out, so the audited UI is the login screen inside the real app shell, not the page itself.
- `/en/settings/account` shows the login prompt when signed out, so the audited UI is the login screen inside the real app shell, not the page itself.
- `/en/settings/locations` shows the login prompt when signed out, so the audited UI is the login screen inside the real app shell, not the page itself.
- `/en/settings/ai-filters` shows the login prompt when signed out, so the audited UI is the login screen inside the real app shell, not the page itself.
- `/en/moderator/items` shows the login prompt when signed out, so the audited UI is the login screen inside the real app shell, not the page itself.
- `/en/moderator/tools` shows the login prompt when signed out, so the audited UI is the login screen inside the real app shell, not the page itself.

## Skipped routes

- `/en/[platformSlug]/[username]` -- no account link found on the first event
