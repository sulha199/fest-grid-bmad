---
backlog_id: IDEA-027
title: "No UI for a user to view/edit their own account profile settings (display name, timezone, locale, email/password)"
captured: 2026-09-15
---

# IDEA-027 — Account profile settings UI

## Capture

Reported by user via `bmad-help` (2026-09-15).

Verified: `apps/web/src/app/[locale]/settings/account/account-settings-content.tsx`'s
`TabbedShell` only has api-keys/subscriptions/posts/notifications tabs
(`locales/en.json` `AccountSettings` namespace confirms no 5th tab). None of these let a user
view or edit their own `User` record (PRD Section 4.8: `displayName`, `timezone`, `locale`,
`email`) — timezone/locale in particular are read by the app (Section 3.7 timezone inference,
Section 5 i18n) but have no self-service UI to set them; email/password changes would also
route through Supabase Auth, unaddressed here.

Not the same gap as CC-018/IDEA-006's account-claim self-service (that's for the social-media
accounts a user subscribes to, not the user's own profile).

## Status

Never scoped in the PRD or epics.md — needs a `bmad-ux` pass to design the tab (and confirm
whether email/password edits go through Supabase Auth's own flow or a custom form) before a
story can be created.
