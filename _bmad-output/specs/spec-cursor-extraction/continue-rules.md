# Continue rules

Evaluated in code after the first request and after every step. The model's cursor fields are inputs, never the decision. Rows are checked top to bottom; the first match wins.

| # | State after the step | Decision |
|---|---|---|
| 1 | No unread slides remain | Stop. |
| 2 | The kill switch is off, or the request-count invariant is exceeded (requests so far above twice the post's unread slides at the start) | Do not start or continue the loop; log which; if slides remain, leave the post flagged partial. |
| 3 | `groupingReason` is `single-event` and the result has at least one event | Stop. |
| 4 | `groupingReason` is `program-lineup` or `dependent-stages`, no follow-up made yet | One follow-up request with all remaining slides, up to 10 images in total; then stop. |
| 5 | Zero events found so far, slides remain, fewer than 2 empty steps | Continue with the next window (a text-free cover is not a stop signal). |
| 6 | Zero events found so far and 2 empty steps already made | Stop. |
| 7 | `groupingReason` is `roundup` or `separate-events`, slides remain, and the last step added at least one new event | Continue. |
| 8 | `groupingReason` is `roundup` or `separate-events`, slides remain, content was found earlier, but the last step added no new event | Stop. |
| 9 | Any other state | Stop. |

Notes:
- "New event" means not already present for the post by normalized name plus start date.
- The first request uses today's window (cover + `MAX_CAROUSEL_IMAGES` slides); the rules are first consulted after it.
- Window size starts at 2 slides and is `floor(25 / items per list slide)` from the last step's observed density, between 1 and 4. The per-call event cap is about 25.
- At-risk signals (`finishReason: MAX_TOKENS`, output tokens at 90% or more of `maxOutputTokens`, events at the per-call cap, `minEventCount` above events plus skipped items) do not change the table: they split the current window and retry it, down to 1 slide, before the table is consulted.
- A leaf (1 slide) that still truncates keeps its result and marks the post partial.
- `claimedItemCount` (for example 203) only informs the "known partial" note and the density estimate; it never extends the loop past the unread slides.
