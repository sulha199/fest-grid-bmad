---
backlog_id: IDEA-033
title: "Event detail schedule (smaller name, add-to-calendar action, location link)"
captured: 2026-09-15
---

# IDEA-033 — Event detail's schedule

## Capture

User request via `bmad-help` (2026-09-15). Event-detail schedule section
(follow-up to the smaller event title in IDEA-030 item 6):

1. **Smaller schedule name** — make the schedule name font-size smaller by
   removing the `text-lg` class, so it scales with the now-smaller event name.
2. **Add-to-calendar action per schedule item** — replace the calendar icon
   with an `add-to-calendar` action icon that adds the **current schedule-item**
   into the user's calendar. Make the icon **bigger and more visible** to the
   user. (Distinct from IDEA-030 item 7, which removes the top-of-page
   add-to-calendar icon — the per-item ones stay.)
3. **Location link** — use the reusable location link component (IDEA-029) to
   show the schedule item's location.
