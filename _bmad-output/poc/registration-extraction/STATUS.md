# Registration extraction POC: status (updated 2026-11-22)

Nothing under `apps/` or `packages/` was touched; no DB writes (the prod connection is the read-only role). `private/` is gitignored and holds real captions, numbers, decoded QR text, downloaded post images and model output.

## Where the results are
- **`findings.md`**: the report. Sections 1-8 are the first POC (2026-11-20: phone detector, scrubber, Gemini trial on caption text). Section 9 is the follow-up (2026-11-21: registration window, multi-event A/B with real images, QR decoding libraries). Section 10 tests the schedule-stage enum and price tiers inside the extraction call. Section 11 (2026-11-22) holds the replays of the highlight composed from typed fields, the placement of new prompt instructions (end vs inline) and the separate stage call.
- `out/` (gitignored, regenerate with the analysis scripts): aggregates only (`7a-counts.txt`, `detector-results.json`, `gemini-summary.json`, `qr-summary.json`, `ab-summary.json`).
- Handoff checklists: `_bmad-output/planning-artifacts/event-registration-cta-handoff-2026-11-20.md` sections 8 and 11.

## Done
- First POC (findings 1-8). Superseded note: the earlier version of this file said the Gemini trial was unfinished; it was finished and written up.
- Follow-up POC (findings 9): prod registration-schedule titles (read-only), A/B replay of three prompt arms on 31 real posts with images, QR decoding on 1,170 real post images with three Node libraries plus OpenCV, esbuild/CJS packaging probe.
- Stage and tiers POC (findings 10): 53 posts x arms A/D/E, 418 calls (daily quota ended the third pass), title classifier over 5,683 stored prod schedules. Offline follow-up (findings 10.4): 260 hand-labelled titles, rule v2, pool re-weighting; the separate text-only stage call was run on 2026-11-22 (findings 11.4).
- Per-type highlight rules (handoff 13 F): `compose-highlight.mjs` has a rule row per event type (ladder, wording, allowed prize kinds, type precedence); 18 offline tests pass; the analyzer reports composed share per rule type.
- Placement factor (handoff 13 D): `arms-placement.ts` puts the new instructions either at the end of the prompt or inline (4e and items 12 to 15); `ab-highlight.ts` now runs F-end vs F-inline on captions and A vs G-end vs G-inline on live posts. Numbering fixed. Earlier stage/tier results are end-placement.
- Highlight composed from typed fields (handoff section 13 C): replayed 2026-11-22 (37 captions x F-end/F-inline, 53 live posts x A/G-end/G-inline, 1 run each) and scored: findings 11. Separate stage call run twice on 60 events: 254/260 (findings 11.4). `dump-prompts.ts` writes the exact assembled prompts to `private/prompts/`.

- **Gemini quota and autostart (2026-11-21):** the local key is on the Free Tier, 500 requests per day per project and model (`gemini-3.5-flash-lite`), reset at Pacific midnight (15:00 WIB in winter). The pending replays total about 1,300 requests, so they run over about three days. `quota-budget.mjs` caps every replay script at 440 attempts per Pacific day (state in `private/quota-counter.json`); `run-when-quota-resets.ps1` runs the queue in priority order and sleeps to the next window; the Windows task `festgrid-poc-autostart` starts it on 2026-11-22 15:10 WIB. On 2026-11-21 evening the owner put a new key in `.env` (limits 15 requests per minute, 250K tokens per minute): `quota-budget.mjs` now also paces calls 4.2 s apart and resets its daily count when the key changes (it stores only a short hash of the key), and the queue was started by hand at about 19:30 WIB; the scheduled task stays as a safety net (a second chain refuses to start while one runs). Log: `private/autostart.log`. Remove: `Unregister-ScheduledTask -TaskName festgrid-poc-autostart -Confirm:$false`.

- **Tiers with audience and conditions (2026-11-22, findings 11.7):** separate text-only call `tier-call.ts` (variants A, B, C), code rule `tier-options.mjs`, scorer `tier-call-analyze.mjs`, gold from `make-tier-gold.mjs`. Variant C ran on all 60 captions on 2026-11-23 (the 13 left over from 2026-11-22, when the daily Gemini quota ended at 500 while `quota-budget.mjs` counted 371, so about 130 requests are unaccounted for; possible shared key with production, not verified). Composer fixes: findings 11.6 and 11.8 (`compose-highlight.mjs`); owner label review applied (11.8).

## Not done / open
- Variant C finished on all 60 captions (2026-11-23): emit decision 10 right, 0 wrong, 1 missed; amounts 50/51; 58/58 prices written in caption; 49 of 60 calls without option or tiers; 0 output-cap hits. Next: one stability run of variant C (about 47 calls).
- Done 2026-11-23: tier call per event (findings 11.10) and cover slide per event on multi-event carousels (findings 11.11, `slide-map.ts`, `slide-cover.mjs`; stable on 6 carousels). Handoff sections J and K written.
- Done 2026-11-24: composer on a fresh 60-caption set (findings 11.17: first look precision 0.86 and recall 0.85, five faults fixed, now 1.00 and 0.93, no longer clean); composer on 63 held-out captions (findings 11.15 and 11.16: precision 1.00 and recall 0.92 after the owner label review, three rules changed, the set is now partly fitted), price-hook highlight built, quota counter lock; slide map with production names (11.13); poster timeline (11.14); location + tier as one text-only call (findings 11.12, merge-call.ts, merge-analyze.mjs): fine for one event, keep the tier call separate for several events; online locations are not geocoded (owner decision, handoff L).
- Next: 2 more runs (about 60 calls) on the live posts where end and inline differ; the slide map with production event names; then bmad-correct-course (the backfill of old events follows its implementation), which must also carry: for a competition without a competition day the submission row counts as the event date (handoff M), no geocoding of online-only locations (handoff L), the merged post-extraction call (11.12), per-event tiers (11.10), the cover slide per event (11.11, optional).
- The 95 draft caption labels (`private/labels-for-review.md`) are still not reviewed by the owner; every precision/recall figure is against those drafts.
- Not measured anywhere: a non-lite Gemini model; flyer-only registration windows against a labelled truth; QR purpose classification (register vs follow vs map vs pay) beyond a manual look at a few posters; destination of dynamic QR redirectors; Lambda cold start with the WASM libraries on the real stack.
- `bmad-correct-course` has not started. Backlog row `IDEA-261121-tvh` (dedup guard) is filed.

## How to reproduce the follow-up (needs `private/`, the local `.env`, the prod read-only URL in `.env.local`)
```
psql "$PROD_READONLY_DATABASE_URL" -f live-posts.sql   # posts whose signed image links are still valid -> private/live-posts.jsonl
node download-live-images.mjs                           # images -> private/img (they expire about 5 days after the scrape)
node qr-bench.mjs && python -I qr-opencv.py && node qr-analyze.mjs
npx tsx ab-multi-event.ts --set multi:6,control:2,window:3 && node ab-analyze.mjs --detail
# highlight from fields (needs quota): node compose-highlight.test.mjs; npx tsx ab-highlight.ts --mode captions --runs 3; npx tsx ab-highlight.ts --mode live --runs 3; node ab-highlight-analyze.mjs --detail
# separate stage call (needs quota): npx tsx classify-titles-call.ts --runs 2 && node classify-call-analyze.mjs --errors
# offline title rule: node make-title-sample.mjs; node eval-title-rule.mjs --rule ./stage-classifier-v2.mjs --merge --split even; node estimate-pool.mjs
# stage and tiers (findings 10):
psql "$PROD_READONLY_DATABASE_URL" -At -f prod-schedule-titles.sql | grep '^{' > private/prod-schedule-titles.jsonl && node classify-prod.mjs
node select-stage-posts.mjs && npx tsx ab-stage.ts --runs 3 && node ab-stage-analyze.mjs --detail   # run ONE replay process at a time
```
