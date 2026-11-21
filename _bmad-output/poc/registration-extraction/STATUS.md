# Registration extraction POC: status (updated 2026-11-21)

Nothing under `apps/` or `packages/` was touched; no DB writes (the prod connection is the read-only role). `private/` is gitignored and holds real captions, numbers, decoded QR text, downloaded post images and model output.

## Where the results are
- **`findings.md`**: the report. Sections 1-8 are the first POC (2026-11-20: phone detector, scrubber, Gemini trial on caption text). Section 9 is the follow-up (2026-11-21: registration window, multi-event A/B with real images, QR decoding libraries). Section 10 tests the schedule-stage enum and price tiers inside the extraction call.
- `out/` (gitignored, regenerate with the analysis scripts): aggregates only (`7a-counts.txt`, `detector-results.json`, `gemini-summary.json`, `qr-summary.json`, `ab-summary.json`).
- Handoff checklists: `_bmad-output/planning-artifacts/event-registration-cta-handoff-2026-11-20.md` sections 8 and 11.

## Done
- First POC (findings 1-8). Superseded note: the earlier version of this file said the Gemini trial was unfinished; it was finished and written up.
- Follow-up POC (findings 9): prod registration-schedule titles (read-only), A/B replay of three prompt arms on 31 real posts with images, QR decoding on 1,170 real post images with three Node libraries plus OpenCV, esbuild/CJS packaging probe.
- Stage and tiers POC (findings 10): 53 posts x arms A/D/E, 418 calls (daily quota ended the third pass), title classifier over 5,683 stored prod schedules. Offline follow-up (findings 10.4): 260 hand-labelled titles, rule v2, pool re-weighting; separate text-only stage call written but NOT run (Gemini daily quota still exhausted on 2026-11-21).
- Highlight composed from typed fields (handoff section 13 C): arms F and G, composer with offline tests, replay and analysis scripts written, NOT run (needs quota).

## Not done / open
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
