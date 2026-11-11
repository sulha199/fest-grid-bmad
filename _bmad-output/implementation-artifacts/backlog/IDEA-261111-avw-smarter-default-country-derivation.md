---
backlog_id: IDEA-261111-avw
title: "Smarter default-country derivation for geocoding"
captured: 2026-11-11
---

# IDEA-261111-avw: Smarter default-country derivation for geocoding

## Capture

Slice 2a (`spec-location-keywords-geocoding.md`) picks the country hint per location text from, in order: the model's code for that text (or the post's consensus), then the platform-wide `DEFAULT_COUNTRY_CODE` (a static env value, default "ID"), then none. The static default is a single guess for the whole deployment. It is wrong for an account whose events are in another country, and wrong everywhere once the app runs in a second market.

Requested by the maintainer: derive the fallback from clues instead of one constant.

1. **The account's own events.** The most common country among the account's already geocoded events, counting only results with good confidence (the earlier idea was at least 3 events and 60 %; tune against data). A wrong earlier geocode must not feed itself, hence the confidence condition.
2. **Where its subscribers come from.** Failing that, the country most of the account's subscribers are in (their stored location or origin), for accounts with too few geocoded events.
3. Only then the static `DEFAULT_COUNTRY_CODE`.

## Open points to settle before building

- What "good confidence" means: Geoapify confidence did not separate right from wrong in the POC (8 correct hits had confidence 0, 3 wrong ones too), so another signal may be needed (match type, agreement with the model's code, moderator-corrected events only).
- Privacy and data: what subscriber location data exists, whether using its aggregate country is acceptable under the PRD, and the minimum number of subscribers before a country is used.
- Where the result lives: computed on demand per extraction, or cached on the account profile (and refreshed when).
- How it interacts with the account default LOCATION, which 2a ignores when its country differs from the hint.

## Where it lives

Extends the pure `resolveCountryHint` function of slice 2a with a new source between the string/consensus code and the platform default. Not scheduled; needs `bmad-prd` for the subscriber-data question first.
