# Backlog ID renumbering, merge of master into the POC branch (2026-11-16)

Old IDs appear in older reviews, memlogs and chat history. Numeric IDs are frozen on master, so every branch-only row got a date-format ID. The branch's former copies of master rows were dropped in favour of master's rows (branch ID = master ID in the second table).

## Branch-only rows, old ID to new ID

| Old | New | Title |
|---|---|---|
| BUG-063 | BUG-261018-ij7 | AI filter region match (adminArea) has no data: nothing in production writes LocationDetai |
| BUG-064 | BUG-261018-nyt | Online events are geocoded as places, multi-venue events lose their venues, location filte |
| BUG-065 | BUG-261018-jwf | Curator events fall back to the curator's account location; inference gives it an arbitrar |
| BUG-066 | BUG-261018-abg | Geocoding can land in the wrong country: soft bias only, no bias at bootstrap, no confiden |
| BUG-076 | BUG-261022-3vh | The scrape cursor can run ahead of what a profile's own scrape captured: mappers stamp the |
| BUG-077 | BUG-261022-7aw | Caption-less posts are rejected and never stored, so the post-based cursor never passes th |
| BUG-078 | BUG-261022-a2z | A failed vendor run is handled differently per vendor and not atomically: an Apify failure |
| FIND-086 | FIND-261018-p1z | A never-classified curator account is treated as an organizer: its captions are not cleare |
| FIND-087 | FIND-261018-9y3 | Query.events: JIT compilation adds ~50 ms or ~800 ms depending on whether the plan's estim |
| FIND-088 | FIND-261019-whr | Discovery selects totalCount it never reads, so every page request runs an extra count(*) |
| FIND-089 | FIND-261019-s82 | Every signed-in Query.events request upserts user_settings only to read hidePastEventsAfte |
| FIND-090 | FIND-261019-yjt | The cloud-session environment holds production-named secrets; the POC's live Gemini runs u |
| FIND-091 | FIND-261019-wfg | Production snapshot 2026-10-19: wrong-country pins, matcher recall 5%, caption duplicates, |
| FIND-109 | FIND-261028-3js | PRD 3.19 does not describe the 2026-10-25 dedup rules (mid-to-high promotion, stub repeat, |
| IDEA-073 | IDEA-261018-iv7 | Canonical area ladder: geocoder writes a country>province>regency>city path; hierarchical, |
| IDEA-097 | IDEA-261022-iyj | Make provider health a persisted state and failover one route: degraded_since, reason and  |
| IDEA-098 | IDEA-261022-sdx | Store the classification evidence on every zero-record run, add an explicit inconclusive c |
| IDEA-102 | IDEA-261026-zlm | Link a schedule-less post (recap, update, 'registration extended') to the event it is abou |
| IDEA-103 | IDEA-261026-l2j | Reposts: read the audience area and country from the original account (extra profile scrap |
| IDEA-105 | IDEA-261027-ugg | Target area in production: a mixed-level set with roles and qualifiers, the venue-without- |
| IDEA-113 | IDEA-261029-hh4 | Per-account monthly intake limit: ring an alarm at a soft limit and stop scraping the acco |
| IDEA-074 | IDEA-261018-i9a | Personalized Discovery: extract each event's target audience (area first), order by it not |
| IDEA-075 | IDEA-261018-vld | Profile enrichment: country, reach and default time zone from the initial profile scrape,  |
| BUG-067 | BUG-261018-q2a | Query.events orders by the next date alone, so offset paging repeats and skips events that |
| IDEA-076 | IDEA-261018-5lm | Scale-safe event list: maintained next-open-date column, open-events index, id tie-break,  |
| IDEA-077 | IDEA-261018-25r | AI filter closest matches: keep events that miss one condition, with a score and the unmet |
| IDEA-078 | IDEA-261018-i93 | Discovery freshness pull (post published_at) and session-snapshot demotion of already-seen |
| IDEA-079 | IDEA-261019-4nt | PostHog: page views, Discovery impressions and rank context, cost-model calibration funnel |
| IDEA-080 | IDEA-261019-2cy | Ranked mode: rank a frozen list of ids once per session, hydrate pages by id, cache conten |
| IDEA-081 | IDEA-261019-3bp | Target-area resolver: place name as written to canonical admin keys from a gazetteer (aggr |
| IDEA-082 | IDEA-261019-kv3 | Prevent slow scans on hot paths: plan-shape guard in CI on the volume seed, JIT off and a  |
| IDEA-083 | IDEA-261019-vi0 | Read-only production check: a least-privilege role, an aggregate-only pack and a plan guar |
| BUG-068 | BUG-261019-ud2 | 27 plain jsonb() columns are stored as JSON strings, not objects (schedules.location_detai |
| IDEA-085 | IDEA-261019-0i7 | Duplicate events: sweep the legacy pairs, let stub pairs reach the candidate threshold, wo |
| IDEA-084 | IDEA-261019-hnl | Event groups: series and programme kinds, deterministic series detection, Discovery collap |
| IDEA-086 | IDEA-261019-1pm | Event identity core: one activity at one place-set; isSamePlace, place normalizer, sibling |
| IDEA-087 | IDEA-261019-lfd | Place model: pin trust, area keys and provenance as three facts; curator audience area; un |
| IDEA-088 | IDEA-261019-wc7 | Split existing multi-place events and backfill upcoming ones: journal, undo, dry-run queue |
| IDEA-089 | IDEA-261019-owq | Activity split: program-lineup items become visible events of a programme group (extractio |
| BUG-069 | BUG-261020-ptv | A moderator receives no email or push notification (PWA installed); failed sends are silen |
| IDEA-090 | IDEA-261020-mqx | Moderator work-queue notifications: a digest email and a push for pending items, with deli |
| BUG-072 | BUG-261020-tqr | One UNAUTHENTICATED response signs the user out: every JWT verification failure maps to it |
| BUG-079 | BUG-261022-v91 | The scraper budget gate counts triggers, not delivered items, so it does not bound failove |
| IDEA-099 | IDEA-261022-b42 | Send posts_to_not_include to Bright Data so a run does not re-fetch stored posts (BUG-074  |
| FIND-095 | FIND-261022-n33 | Smaller deferrals from the BUG-074 hotfix code review: the dead_page signature is provisio |
| IDEA-092 | IDEA-261021-8q8 | Audience, language and taxonomy POC: a labelled set of real events, three runs, pre-set th |
| IDEA-093 | IDEA-261021-80f | Interest taxonomy, interest profile and the sensitive-interests switch (AD-42 Rules 7-8) |
| FIND-093 | FIND-261021-2ku | The repository is public (MIT) and holds the premium personalization plans, AD-42, the POC |
| IDEA-094 | IDEA-261021-6dy | Open-core split: public MIT core, private premium package and repository, ports with no-op |
| FIND-094 | FIND-261021-pgf | Moderator pages and badges fall short of the UX floor: hard-coded English toasts, a pendin |
| BUG-087 | BUG-261027-smw | LocationDetails.city is often a kecamatan (DIY schedules: Depok 352, Mlati 48, Banguntapan |
| IDEA-106 | IDEA-261028-3ov | Tell an event report or news post from an announcement in the AI extraction (post_kind: an |
| IDEA-108 | IDEA-261028-v4z | Use the additive link for the mid-to-high promotion, not overwrite-and-prune (AD-30 Rule 7 |
| IDEA-109 | IDEA-261028-ki5 | Write an undo-journal row (event_merges) for ingestion-time auto-links, so a wrong high-ti |
| IDEA-111 | IDEA-261028-qa9 | Insight POC case: the Erafone Run 2026 Yogyakarta family (12 live events): which are serie |
| IDEA-112 | IDEA-261029-hjq | Keep one account from flooding Discovery: collapse repeats and cap per-account volume in t |
| IDEA-114 | IDEA-261029-s33 | Store price lines per track in the original currency and derive price bands per country at |

Kept as they were, because master's shipped code comments cite them: BUG-073, BUG-074, BUG-075, IDEA-095, IDEA-096 (these five still fail backlog-check 17).

## Master rows the branch had numbered differently (old branch ID = master ID)

BUG-070=BUG-063, BUG-071=BUG-064, BUG-080=BUG-066, BUG-081=BUG-065, BUG-082=BUG-076, BUG-083=BUG-077, BUG-084=BUG-078, BUG-085=BUG-080, BUG-086=BUG-081, BUG-088=BUG-082, BUG-089=BUG-083, FIND-092=FIND-086, FIND-096=FIND-088, FIND-097=FIND-089, FIND-098=FIND-090, FIND-099=FIND-091, FIND-100=FIND-087, FIND-103=FIND-092, FIND-104=FIND-096, FIND-105=FIND-097, FIND-106=FIND-098, FIND-107=FIND-099, FIND-108=FIND-100, IDEA-091=IDEA-073, IDEA-100=IDEA-097, IDEA-101=IDEA-098, IDEA-104=IDEA-100 (branch ID on the left, master ID on the right; text written before 2026-11-16 uses the left side).
