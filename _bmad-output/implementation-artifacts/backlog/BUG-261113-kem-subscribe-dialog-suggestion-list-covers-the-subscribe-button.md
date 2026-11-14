---
backlog_id: BUG-261113-kem
title: "Subscribe dialog: the voted-account suggestion list never closes on its own and covers the Subscribe button"
captured: 2026-11-13
---

# BUG-261113-kem: Subscribe dialog: the voted-account suggestion list never closes on its own and covers the Subscribe button

## Capture

Found in the review of Story 10.3a (show the subscription cap refusal and the upgrade call to action); the behaviour is old.
In `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx` (about lines 144 to 190) the suggestion list is `absolute`,
full width, at the overlay-modal tier. It opens when the handle field has 2 or more characters and closes only when a suggestion is
picked: there is no blur, outside-click or Escape handling. It sits over the Subscribe button, about 24 px below the field, on any
viewport, so a user who typed a handle and then taps Subscribe taps the list instead (Playwright reports the list "intercepts pointer
events").

Failure scenario: type `jkt`, the list opens ("No matching voted accounts found"), tap Subscribe: nothing happens. The only ways out
are picking a suggestion or submitting with Enter. The Story 10.3a e2e specs submit with Enter because of this.

## Fix

Close the list on blur, on an outside click and on Escape, or render it in flow (pushing the footer down) instead of over it.
Add a Playwright check that the Subscribe button is clickable after typing a 2-character handle.
