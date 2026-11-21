# Registration extraction POC: checkpoint (2026-11-20)

Session paused mid-way. Nothing under apps/ or packages/ was touched; no DB writes; `private/` is gitignored (real captions, numbers, labels).

## Done
- 7A counts: `out/7a-counts.txt` (aggregates only; Q1-Q15). Rerun: `bash run-7a.sh`.
- Section 6 verifications (code reads), findings are NOT yet written into findings.md (see "Findings so far").
- Sample of 95 real captions + 5 synthetic abuse cases (`fixtures/synthetic-abuse-captions.json`); draft labels by Claude in `private/make-labels.cjs`, review sheet `private/labels-for-review.md` (owner review still pending).
- `detect-phones.ts`, `scrub-contact-data.ts` (+ `scrub-tests.ts`, 20/20), `eval-detector.ts`, `run-corpus.ts`, `heldout2.ts`.
- Gemini trial script `gemini-trial.ts` (wraps the production request builder; extended prompt+schema in memory). Runs resume safely: `npx tsx gemini-trial.ts --ids <list> --arms base,ext --runs 3`. About 118 of 128 calls were done at the pause; finish by rerunning the same command (see git history / this file for the id list: S01,S03,S04,S05,S06,S08,S10,S17,S23,S25,S27,S29,S32,S34,S26,S31,S45,S52,S61,S63,S66,S70,S71,S73,S78,S87,S89,S92,S93,S94,S79,S84), then the 5 synthetic cases: `--ids X1,X2,X3,X4,X5 --runs 2`.
- `analyze-gemini.ts` scores the runs (writes `out/gemini-summary.json`).

## Not done
- Finish trial + X1-X5 abuse runs, run `analyze-gemini.ts`.
- Write `findings.md`; update handoff section 8 checklists; recommendation on bmad-correct-course.
- Owner: review draft labels; answer policy questions (business/venue lines and shopper lines as WhatsApp CTA?).

## Findings so far (aggregates, no real data)
- Active events 4,017; `has_private_contact` 927 (23%). 4,585 posts keep a caption (non-curator accounts); `Post.content` is readable by subscribers via `postsByAccount`. So "raw contact never stored" is already false at post level, and D2's "delete at event end" would not cover captions.
- Detector over 2,801 distinct captions: 382 (13.6%) have a number; 310 phone-only, 72 phone+link; 147 link-only; 50 QR-only. 104 of 382 have 2+ numbers; 13 are in multi-event posts. Only ~20% of numbers sit next to an explicit registration word; rest are generic contact numbers.
- Detector P/R: dev sample 58/58 (tuned on it, optimistic); fresh held-out about 92-94% precision, about 97-99% recall (donation/sponsor lines are the false positives).
- Scrubber: 0 leaks over 2,992 captions, 0 prices/times mangled.
- Gemini lite, extended schema: prompt tokens +12.9%, output +36%; highlights 100% number-grounded; never emitted evidence/eligibility/instruction; put wa.me URLs in `url` and person names in labels (21%); messageTemplate verbatim when present (template prevalence only 5/2,992 captions).
- Existing gap: `UNPROCESSED_PAYLOAD_RETENTION_DAYS` is never read; 107 raw payloads since 2026-09-04 remain.
