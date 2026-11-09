# Evidence

Measured on prod on 2026-11-09 (read-only), plus a live Gemini replay with the production prompt. Single runs; the model varies run to run (the Samsat poster returned 7, 6 and 1 schedules from the same image).

## Post shapes (60 days, 4,296 extracted posts)

| Fact | Value |
|---|---|
| Posts with more images than the read cap (cover + 5) | 209 (4.9%): 132 with 7-10 images, 77 with 11 or more |
| Of those 209: single-event or dependent-stages | 138 (must not chunk) |
| Roundup posts | 12 (7 of 12 have 3 images or fewer; 6 hit the 10-event cap) |
| One-event posts with 3 or more schedules | 134 of 2,784; 58 have a single image; maximum 20 schedules |
| Separate-events posts with 2-9 events | 80: 42 put several events on one image, 14 have one event per image, 13 one per slide after the cover; all but 4 fit within the 6-image read cap |

## Scout experiment (21 sampled posts with valid images)

Variants: first 2 images, first 3, all images up to 10; one run each.

| Shape | First 2 images | First 3 images |
|---|---|---|
| Roundup `DfaE-29koB6` (6 images) | labelled `program-lineup`, 3 events (all 6 images: `roundup`, 17) | `separate-events`, 6 events |
| Roundup `DfRtgnXE_41` (8 images) | `roundup`, 5 events (all 8: 26) | `roundup`, 10 events |
| Separate events `DfWjrm1IAc0` (6 images, 4 events) | `single-event`, 1 event | `separate-events`, 4 events |
| One event, many schedules | counts grew with slides in 2 of 8: 2, 5, 19 across 2, 3 and 9 images; 6, 10, 15 across 2, 3 and 5 | same |
| Big carousels (7+ images) | 5 of 8 stay one event with one schedule; 1 was a roundup; 2 had text-free first slides (0 events at 2-3 images) | same |

The model returned 17 and 26 events despite a prompt cap of 10; the cap is enforced only by code truncation. Output at about 3 events per image reaches the 8192-token limit near 30 events per call.

## Cost model

Token counts are from the Gemini SDK; prices are third-party trackers, not Google's rate sheet: $0.30 per 1M input, $2.50 per 1M output, $0.03 per 1M cached input (verify at ai.google.dev). Thinking tokens were not measured (the live usage call hit a 503).

| Item | Tokens | Cost |
|---|---|---|
| System prompt, every call | 4,637 | about $0.0014 |
| One 516 x 640 image | about 1,120 | about $0.0003 |
| Output per extracted event | about 195-255 | about $0.0006 |
| Ordinary post (about 5.8k in, 0.3k out) | | about $0.0025 |
| URUP-scale roundup (14 images, about 200 events, 5 calls) | | about $0.14 |

Output dominates cost, so the lever is how many events are extracted, not how many slides are read. Current prod volume (4,296 posts per 60 days) is about $5 a month.

## Related prod findings

- Roundup `DfRtgnXE_41` has 0 events in prod: it hit the low-budget text-only bug fixed in PR #180 and was marked extracted with no events.
- The Gemini client (`apps/backend/src/lib/ai-gateway/gemini-client.ts`) returns only `text`; `finishReason` and `usageMetadata` are discarded, and a JSON parse failure in `processAiJob` logs and returns silently.
- Instagram image URLs expire about 5 days after scraping.
