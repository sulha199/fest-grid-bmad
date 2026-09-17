# PRD Outline — FestDaily

A navigation aid for `prd.md` (1,443 lines). This groups its sections by
what they're actually about — not just their raw numeric order — and gives
each one a one-line purpose and its current line range, so a reader (human
or an agent following `discover-inputs.md`'s Step 2b) can jump straight to
what's relevant with a single targeted read instead of loading the whole
document.

**This is a navigation index, not a fork of the PRD.** `prd.md` stays the
single source of truth; nothing here duplicates its normative content.
Line ranges were generated with `scripts/md-outline.py outline prd.md
--max-depth 4` and are accurate as of 2026-09-17 — **if `prd.md` has been
restructured since, re-run that command rather than trusting stale numbers
here.** Group labels and one-line purposes are hand-authored and won't
auto-update; re-check them whenever a section's scope materially changes.

To read any range below: `Read prd.md` with `offset` = the range's start
line and `limit` = (end − start + 1).

---

## 1–2. Introduction & Goals (lines 16–26)

Front matter — product framing and the goal statements other sections
justify themselves against (e.g. "serving the Engagement goal, Section 2").
Cheap enough to load whenever any Features section is in play.

---

## 3. Features — grouped by what they serve

The PRD's own numbering (3.1–3.17) is chronological-by-authorship, not
topical. Regrouped here into six clusters:

### A. Core Discovery & Personal Lists
The base browsing/personal-list experience — what an unauthenticated or
casual user sees first.

| Section | Lines | Purpose |
|---|---|---|
| 3.1 Event Discovery | 29–36 | Curated listing, FilterHub search, default ongoing/upcoming view, status/nearby badges |
| 3.2 Personalization Features | 37–42 | Favorite events + dedicated Favorites/Added-Events pages |
| 3.3 Saved Location Preferences | 43–47 | Named locations, current-location-or-map-pick, radius-based "nearby events" |
| 3.4 Event Management | 48–57 | Calendar add (one-way), detail-view centralization, source/account attribution, video prioritization |
| 3.5 Global View Rules | 58–62 | Default ongoing/upcoming filter; N-day hide rule for favorited/added events |
| 3.6 Calendar View Enhancements | 63–67 | Visual distinction + show/hide toggles for favorited/added events on the calendar |

### B. Social Media Ingestion & Subscription — the hub cluster
**3.7 is the most cross-referenced section in the whole PRD** (9 inbound
references from elsewhere) — nearly every other feature that touches
scraped data, accounts, or AI extraction leans on it. Load it whenever an
adjacent section is in scope, not just when it's the direct target.

| Section | Lines | Purpose |
|---|---|---|
| **3.7 Social Media Account Subscription** | **68–116** | **Hub.** BYOK subscription model, scraper-adapter approach, Default Location (incl. AI inference + confidence gate), quota fairness algorithm, calendar/card display, public account pages, timezone inference, API key validity handling |
| 3.8 Gemini API Management and Capacity | 117–127 | AI Gateway throttling/queuing, suspicious-activity mitigation, MVP capacity limits, capacity formula |
| 3.9 Manual Event Data Correction and User Reporting | 128–170 | Typed-input corrections (3.9.1), report/moderate flow (3.9.2), user + moderator UI incl. pending-item badge (3.9.3) |
| 3.10 Manual Post Selection for Event Extraction | 171–193 | Tab-per-account post picker, quota-aware selection, inactive-account handling, wizard integration |

### C. Onboarding & Global UX Patterns
Cross-cutting conventions, not a single feature.

| Section | Lines | Purpose |
|---|---|---|
| 3.11 Getting Started and Onboarding | 194–197 | Free signup, optional BYOK key setup guidance |
| 3.12 Global UI & Navigation Patterns | 198–211 | Blocking vs. non-blocking loaders, infinite scroll, context-aware next/prev detail navigation |

### D. Growth & Distribution
Ways FestDaily reaches people who aren't subscribers yet.

| Section | Lines | Purpose |
|---|---|---|
| 3.13 Vote for Social Media Accounts | 212–224 | Pre-subscription demand signal — vote list, "near me" ranking, feeds into 3.7's subscription autocomplete |
| 3.14 Embeddable Discovery Widget | 225–239 | Public iframe widget, persisted `Widget` config, domain whitelist, responsive sizing |

### E. AI-Powered Filtering
| Section | Lines | Purpose |
|---|---|---|
| 3.15 AI Prompt-Based Custom Event Filter | 240–256 | Free-text prompt → `EventFilterInput`, locked vocabulary, graceful degradation, save/reuse as "My AI Filters" |

### F. Data Governance & Trust
| Section | Lines | Purpose |
|---|---|---|
| 3.16 Scraping & Display Data Minimization | 257–266 | Hotlink-by-default image policy, opted-in prominent card treatment, profile-image never stored |
| 3.17 Self-Service Account Claim & Ownership Verification | 267–279 | Bio-code verification challenge, claim grants image-storage opt-in control, contested-claim moderation |

---

## 4. Event Data Schema — grouped by domain

**This section is 1,053 of the PRD's 1,443 lines (73%)** — a flat catalog
of 20 independent TypeScript-style interfaces with almost no prose linking
them. A story touching one interface essentially never needs the other 19.
Grouped here by what each interface actually models:

### Core Event Data
| Interface | Lines | Purpose |
|---|---|---|
| 4.1 EventInfo | 284–423 | The event itself — the central record everything else attaches to |
| 4.2 Coordinates | 424–435 | Lat/lng pair, used wherever a location is stored |
| 4.3 LocationDetails | 436–493 | Resolved location (address, admin-area, venue type) from geolocation lookup |
| 4.4 Schedule | 494–577 | One event's occurrence(s) — dates, times, recurrence/weekday narrowing |

### Social Media & Content Source
| Interface | Lines | Purpose |
|---|---|---|
| 4.5 SocialMediaAccountProfile | 578–671 | The scraped account — platform, handle, Default Location, image-opt-in, claim state |
| 4.7 Post | 708–778 | One scraped post — image/video URLs, hashtags, source-post links |

### User & Personalization
| Interface | Lines | Purpose |
|---|---|---|
| 4.6 UserLocationPreference | 672–707 | A user's saved named location (Section 3.3) |
| 4.8 User | 779–814 | The user account itself |
| 4.9 Subscription | 815–840 | User-to-account subscription link (Section 3.7) |
| 4.10 Favorite | 841–866 | User-to-event favorite link (Section 3.2) |
| 4.11 CalendarEntry | 867–899 | User-to-event "added to calendar" link |

### Moderation & Corrections
| Interface | Lines | Purpose |
|---|---|---|
| 4.12 Report | 900–939 | A user's event report (Section 3.9.2) |
| 4.14 DefaultLocationChangeRequest | 982–1053 | Pending/approved Default Location change, incl. AI-inference confidence trail (Section 3.7) |

### Access & Growth
| Interface | Lines | Purpose |
|---|---|---|
| 4.13 ApiKey | 940–981 | A user's BYOK Gemini key |
| 4.15 AccountVote | 1054–1083 | A vote for an unsubscribed account (Section 3.13) |
| 4.20 AccountClaim | 1283–1333 | Account-ownership claim + bio-code verification state (Section 3.17) |

### Distribution & Filtering
| Interface | Lines | Purpose |
|---|---|---|
| 4.16 Widget | 1084–1129 | A persisted embeddable widget config (Section 3.14) |
| 4.17 EmbedDomain | 1130–1166 | A widget's whitelisted embedding domain pattern |
| 4.18 EventFilterInput | 1167–1241 | Shared filter shape used by FilterHub, widgets, and AI filters alike |
| 4.19 AIEventFilter | 1242–1282 | A saved AI-prompt-derived filter (Section 3.15) |

---

## 5–8. NFRs, Monetization, KPIs, Post-MVP (lines 1334–1443)

Small (~110 lines total) and broadly relevant rather than feature-specific
— cheap enough to load in full whenever any of these four are in play.

| Section | Lines | Purpose |
|---|---|---|
| 5. Non-Functional Requirements | 1334–1383 | Performance, scalability, reliability, security, i18n, etc. (11 sub-items, each 3–8 lines) |
| 6. Monetization Strategy | 1384–1403 | `free_user`/`contributing_user` tiers, subscription cap |
| 7. Key Performance Indicators (KPIs) | 1404–1422 | Success metrics |
| 8. Post-MVP Features | 1423–1443 | 5 explicitly deferred items (map view, custom slug, spatial indexing, AI digests, price filtering) |

---

## Cross-reference map

Always by explicit section number, which is why selective reading works
here without losing the thread — but denser than a first skim suggests
(verified by scanning every `Section X.Y` mention and resolving it to its
enclosing section, not just spot-checking a few):

- **Section 3.7 has 17 distinct inbound references** — from 3.4, 3.8, 3.9,
  3.13, 3.14, 3.15, 3.17, Section 6, and 8 different Section-4 interfaces
  (4.3, 4.5, 4.7, 4.8, 4.9, 4.11, 4.13, 4.14, 4.20). Treat it as a
  near-default include whenever touching subscriptions, scraping, quota,
  or moderation — this is by far the PRD's most load-bearing section.
- **13 of the 20 schema interfaces are referenced from outside Section 4**
  (i.e. a Feature or NFR section cites them directly, not just other
  schema interfaces citing each other): 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8,
  4.9, 4.14, 4.15, 4.16, 4.17, 4.18, 4.20. When reading a Features section,
  check this list before assuming the schema half can be skipped entirely.
- Only **4.2 (Coordinates), 4.10 (Favorite), 4.11 (CalendarEntry), 4.12
  (Report), 4.13 (ApiKey), and 4.19 (AIEventFilter)** are referenced
  exclusively from within Section 4 (or not cross-referenced at all) —
  these are the ones genuinely safe to skip unless directly targeted.
