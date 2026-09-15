---
backlog_id: IDEA-030
title: "Event detail UI refinements (layout, published info, hashtags, badges, favorite/title)"
captured: 2026-09-15
---

# IDEA-030 — Event detail UI refinements

## Capture

User request via `bmad-help` (2026-09-15). Batched event-detail-page UI changes:

1. **Responsive layout** — desktop keeps `event-main-content` displayed on the
   right (as today). Mobile adds an adjustment so `event-main-content` is
   displayed at the **top**.
2. **Published-date inline with the view-original link** — in
   `event-main-content`, add info about when the post was published, inlined
   with the "view original post" link. Use the existing short-date format,
   e.g. `Sep 7 · <Link open-in-new-tab><Platform-Icon> View Original ↗</Link>`.
   Ensure i18n is implemented for these texts.
3. **Hashtags** — display the post's hashtags at the bottom of
   `event-main-content`, above the view-original link. Clicking a hashtag opens
   the Discovery page with the clicked hashtag as an additional
   `search-text` param. (Needs hashtag data — depends on BUG-032.)
4. **Event-category / event-type badges clickable** — each badge opens the
   Discovery page with the related event-type/event-category.
5. **Favorite icon** — move it to the right, inlined with the event title.
6. **Event title size** — make the title font smaller using `text-2xl`.
7. **Remove the add-to-calendar icon at the top** of the page.

## Notes / dependencies

- May fan into multiple stories (layout work vs content/link additions vs
  favorite/title tweaks).
- Item 7 removes the top-of-page add-to-calendar icon only — per-schedule-item
  add-to-calendar actions are a separate concern (IDEA-033 item 2).
- Depends on hashtag persistence (BUG-032) for item 3 to have data, and on the
  reusable location link component (IDEA-029) where location surfaces are shown.
