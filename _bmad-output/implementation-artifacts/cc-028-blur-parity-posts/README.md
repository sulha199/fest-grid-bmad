# CC-028 extraction parity check (Story 3.20, Task 9)

Live extraction-parity results comparing the ORIGINAL (unblurred) image vs. the BLURRED
(pre-AI face-blur, `{ blurFacesBeforeAi: { isOwnerOptedIn: false } }`) image sent to Gemini,
for six real Instagram posts: the four `cc-024-reference-posts` fixtures (reused by post URL
only -- this check re-scrapes fresh every run per AC7, it does not read their committed JSON)
plus two new posts with no prior recorded expected result.

**No post image is committed here** (they show real people's faces) -- only extraction outputs
and the difference analysis. The scrape cache (with its signed, expiring image links) stays in
the already-gitignored `apps/backend/scripts/.poc-cache/`, never committed.

## Posts checked

| # | Post URL | Status |
|---|---|---|
| 1 | `https://www.instagram.com/p/DdV_7Jsk6pw/` (sleman-city-hall-reborn) | Established baseline (cc-024) |
| 2 | `https://www.instagram.com/p/DdT1cgTlJ2k/` (smi-drum-contest) | Established baseline (cc-024) |
| 3 | `https://www.instagram.com/p/DcntzF0mB7z/` (laridijogja-roundup) | Established baseline (cc-024) |
| 4 | `https://www.instagram.com/p/Ddi9wU6RCRQ/` (vifation-2026) | Established baseline (cc-024) |
| 5 | `https://www.instagram.com/suzurunberiman/p/Dd6SHRZzxI8/` | **New** -- no prior recorded result; baseline is this run's original-arm output, reviewed and confirmed below |
| 6 | `https://www.instagram.com/merapiperformance/p/DdVwNyFATse/` | **New** -- no prior recorded result; baseline is this run's original-arm output, reviewed and confirmed below |

## Method

Run via `build-gemini-request.live-cc028-blur-parity.test.ts` (opt-in, gated on
`RUN_LIVE_GEMINI_TESTS=true` + `SYSTEM_GEMINI_API_KEY`), which re-scrapes each post fresh, then
runs `buildGeminiExtractionRequest` `CC028_LIVE_RUNS` times per arm (original, then blurred),
sequentially. A difference is **material** (Task 9.5) only when the blurred arm produces an
event count, grouping reason, name, or date that the original arm's runs for that post **never**
produced across all its runs -- never a difference between a single pair of runs, since
extraction is already known to be non-deterministic run-to-run independent of blurring (the
CC-024 prototype's post 4 "Vifation" collapsed once in two runs with no code change at all).

Two runs were performed: an initial 3-runs-per-arm pass, then a 5-runs-per-arm pass for a
stronger signal once the 3-run pass flagged ambiguous results.

## Results

### 5-runs-per-arm pass (2026-10-04, final)

| # | Post | Cover faces (blurred) | Original arm (5 runs) | Blurred arm (5 runs) | Material difference? |
|---|---|---|---|---|---|
| 1 | sleman-city-hall-reborn | 16, 16, 16, 16, 16 | `program-lineup`, 1 event, dates stable, name "Celebrating 8th Anniversary Sleman City Hall: REBORN" (all 5 runs) | Identical except run 4's name dropped "Celebrating " -> "8th Anniversary Sleman City Hall: REBORN" | Flagged by the test (exact-string name match) -- **assessed as free-text rephrasing of the same event, not a missed/altered event.** Event count, dates, grouping identical across all 10 runs. |
| 2 | smi-drum-contest | 0, 0, 0, 0, 0 | `dependent-stages`, 1 event, identical name/dates, all 5 runs | Identical to original, all 5 runs | **No difference.** Zero faces detected -- blur-identical bytes, proves nothing about degradation either way (Task 9.4). |
| 3 | laridijogja-roundup | 0, 0, 0, 0, 0 | `roundup`, 5 events, identical names/dates, all 5 runs | Identical to original, all 5 runs | **No difference** on this pass. (A prior 3-runs-per-arm pass saw one blurred run jump to 10 events -- see "Prior 3-run pass" below; re-running at 5 runs/arm did not reproduce it, consistent with this exact post's own documented instability, see `cc-024-reference-posts/README.md`'s note that it produced up to 39 events in the original prototype, independent of blurring.) Zero faces detected -- blur-identical bytes. |
| 4 | vifation-2026 | 0, 0, 0, 0, 0 | `separate-events`, 3 events (Billiard/PES/Futsal), identical names/dates, all 5 runs | Identical except run 3's names changed case: "Vifation" -> "VIFATION" | Flagged by the test (exact-string name match) -- **assessed as capitalization noise on the same 3 tournaments.** Event count, dates, grouping identical across all 10 runs. Zero faces detected -- blur-identical bytes, so blurring literally cannot be the cause of a capitalization choice. |
| 5 | suzurunberiman (new) | 1, 1, 1, 1, 1 | `single-event`, 1 event ("Cari Teman PeLARIan Special Shake Out Run[...]"), date `2026-10-03`, all 5 runs | Identical event count/date/grouping; name wording varies run-to-run (same pattern already seen in the original arm's own run 1 vs. runs 2-5) | Flagged by the test (exact-string name match) -- **assessed as the same free-text rephrasing noise seen in the ORIGINAL arm's own runs** (run 1 already differs in wording from runs 2-5 with no blur involved). **Baseline reviewed and confirmed correct:** real single running event, "Cari Teman PeLARIan" / Shake Out Run, 2026-10-03. |
| 6 | merapiperformance (new) | 1, 1, 1, 1, 1 | `isEvent: false` (groupingReason `undefined`, 0 events), all 5 runs | `isEvent: false` (0 events) all 5 runs; `groupingReason` field inconsistently present (`single-event` in runs 1-3, `undefined` in runs 4-5) despite 0 events in every run | Flagged by the test (groupingReason field) -- **assessed as a non-authoritative metadata-field inconsistency on a zero-event response**, not a real extraction difference: **0 events in literally all 10 runs across both arms.** **Baseline reviewed and confirmed correct:** this post is not a recognizable event poster/caption -- `isEvent: false` is the correct extraction outcome, with or without blurring. |

### Prior 3-runs-per-arm pass (2026-10-04, superseded by the 5-run pass above)

Kept for the record since it is what first surfaced post 3's instability:

- Posts 1, 2, 4, 6: no material difference.
- Post 3 (laridijogja-roundup): original arm stable at 5 events (all 3 runs); blurred arm's 3rd run jumped to 10 events with different names/dates -- initially flagged, but zero faces were detected on this post's cover in every run (blur-identical bytes), and this exact post is the one `cc-024-reference-posts/README.md` already documents as producing up to 39 events in earlier (non-blur-related) prototype runs. The 5-run re-run above did not reproduce the jump, consistent with pre-existing non-determinism rather than a blur-caused effect.
- Post 5 (suzurunberiman): original arm's 3 runs already showed 3 different name phrasings of the same single event/date; blurred arm added 2 more phrasings of the same event -- the same free-text rephrasing noise class confirmed in the 5-run pass.

## Conclusion

Across both passes (8 runs/arm cumulative for most posts), **no post showed a missed event,
wrong date, wrong event count, or wrong grouping decision attributable to blurring.** Every
flagged "material difference" traces to one of two known, blur-independent noise sources:
(a) Gemini's own free-text event-name phrasing varying run-to-run (observed within a single arm's
own runs too, e.g. post 5's original arm), or (b) this story's comparison script's exact-string
name-matching being oversensitive to that phrasing noise. Post 3's one-off event-count jump
reproduced the pre-existing, already-documented instability of that specific roundup post, not a
new blur-caused failure mode, and did not reproduce on a second, larger-sample run.

**Decision (confirmed with the user, 2026-10-04):** accept these results as pre-existing
extraction non-determinism, not blur-caused degradation. Pre-AI face-blur (Story 3.20) is
extraction-safe across all six posts checked. IDEA-058 (eyes-only redaction) remains deferred,
not triggered by this result.
