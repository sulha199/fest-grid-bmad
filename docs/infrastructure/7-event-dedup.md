# 7. Event Dedup

*   **What it does:** Stops one real-world event from becoming several `events` rows when it is posted more than once (a hype post, a registration reminder, a medal reveal, a roundup). Runs on the write path only, inside the ingestion Lambda, after extraction and before the insert.
*   **Authority:** Architecture Spine **AD-30 Rule 7** (matching) and **Rule 9** (merge). The flow is drawn in `_bmad-output/planning-artifacts/diagrams/event-dedup-flow.html`. This page is the operator's summary; the spine wins on any disagreement.
*   **Code:** `findMatchingEvent` (`apps/backend/src/lib/events/match-event-to-existing.ts`), scoring and thresholds (`packages/domain/src/events/match-scoring.ts`), merge and undo (`apps/backend/src/lib/events/merge-events.ts`), operator merge (`apps/backend/src/merge-events-by-slug.ts`), backlog drain (`apps/backend/src/drain-event-match-backlog.ts`).

## How a new event is matched

1. **Idempotency.** `(post, extraction_ordinal)` already represented → skip. Never reaches matching.
2. **Candidates.** Active events (not deleted, not merged, not already linked to this post) whose name is trigram-similar (`> 0.3`), and that either have a schedule within **±2 days** of a new schedule, or share a normalized event link with the new item and have a schedule within **±90 days**. At most 20 rows.
3. **Score.** Organizer 0.40 + shared link 0.20 + mean(name similarity, date proximity) × 0.25 + venue 0.15. **High ≥ 0.75, mid ≥ 0.45, low below.** Roundup and curator posts get no organizer weight from the posting account.
4. **Promotion (2026-10-25).** The score tops out near 0.65 when the venue or the shared link is missing (usually one side has no `location`), so an obvious duplicate sat at mid. A **mid is promoted to high** when *all* of these hold (`decideMatchTier`, `packages/domain/src/events/match-scoring.ts`):
    * a schedule is within **±2 days** (never for a candidate admitted only by the shared link);
    * the names are the same: equal after lowercasing and dropping punctuation, years and bracketed groups, **or** trigram similarity ≥ 0.85 with the same digit tokens in the same order (so "Sale" and "Sale - Day 12", or "Part 1" and "Part 2", stay apart);
    * **no venue conflict**: a side with no venue never conflicts; venue texts that are equal or contain one another, or coordinates within 5 km, are compatible; two known, clearly different venues (a tour: Bandung vs Surabaya) block. Only schedules inside the date window are compared;
    * the posting account matches the candidate's account, or a link is shared. With the current weights a mid cannot be reached without one of the two, so this condition is implied; it is kept explicit so a future weight change cannot silently drop it.

    Weights and thresholds are unchanged. A promoted pair is logged with `promotedByRule: true`.
5. **Tier outcome.**
    * **High:** enrich the existing event and promote the better primary post. No new row.
    * **Mid:** insert as its own event and queue one `event_match_candidates` row. A moderator accepts (a merge) or rejects it.
    * **Low:** plain new event.
6. A candidate with **no schedule within ±2 days** (admitted only by the shared link) is capped at **mid**. It is never auto-linked, promotion included.

## Reading the auto-link rate (CloudWatch)

The high path leaves no row behind, so every ingestion match decision writes one JSON line, `event_dedup_decision`, to the Ingestor Lambda's log group (`FestgridBackendStack-prod-IngestorLambdaprodD47C8C-QtiWoT3ac652`; use `MSYS_NO_PATHCONV=1` in Git Bash). It holds ids, the tier, the score and the signals, never an event name, caption or account id. `outcome` is `linked` (high), `queued` (mid), or `new` (low, or no candidate). It is written after the transaction commits, so a rolled-back attempt logs nothing.

```
fields @timestamp, @message
| filter @message like /"event":"event_dedup_decision"/
| parse @message /"outcome":"(?<outcome>[a-z]+)"/
| parse @message /"promotedByRule":(?<promoted>true|false)/
| stats count(*) as decisions,
        sum(outcome = "linked") as linked,
        sum(outcome = "queued") as queued,
        sum(outcome = "new") as fresh,
        sum(promoted = "true") as promoted,
        sum(outcome = "linked") * 100.0 / (sum(outcome = "linked") + sum(outcome = "queued")) as auto_pct_of_matched
  by bin(7d)
```

`auto_pct_of_matched` is the share of matched pairs resolved without a moderator. To see what the rule contributes, group by `promoted`; to find a bad auto-link, list `outcome = "linked"` lines with `promotedByRule` true and look the ids up (`candidateEventId` is the event that absorbed the post). Lines exist only from the deploy of this change on; earlier history is inferred from extra `event_posts` rows per event.

## Why a deadline post and a race-day post are different

Registration windows are schedules of the event (spine Rule 5), so the post announcing the registration deadline carries *that* date, and the post about the race day carries another. They can be weeks apart. Before BUG-063 (2026-10-18) the ±2-day window hid them from each other; GembiRun Loka 2026 became three events that way. Dates alone cannot link them: the link, name, venue and account do.

## Finding duplicates on PROD (read-only)

Use `PROD_READONLY_DATABASE_URL` from `.env.local`. It is a read-only role; never point `DATABASE_URL` at it.

```sql
-- Same normalized link on more than one active event.
WITH links AS (
  SELECT e.id, e.slug, e.event_name,
         regexp_replace(split_part(lower(btrim(l #>> '{}')), '?', 1), '/$', '') AS url
  FROM events e,
       jsonb_path_query(
         CASE WHEN jsonb_typeof(e.links) = 'string' THEN (e.links #>> '{}')::jsonb ELSE e.links END,
         '$[*].url') AS l
  WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL AND e.links IS NOT NULL
)
SELECT url, count(*) AS events, array_agg(slug) AS slugs, array_agg(event_name) AS names
FROM links GROUP BY url HAVING count(*) > 1 ORDER BY events DESC;
```

Pending suggestions: `SELECT * FROM event_match_candidates WHERE status = 'pending'`.

## Merging duplicates that dedup missed

1. **A pending suggestion exists:** a moderator accepts it (`resolveSuggestedEventMatch`).
2. **No suggestion exists:** run the operator script against the database to change. It calls the same `mergeEvents()`, so the result is journaled in `event_merges` and reversible with `undoEventMerge`. It is a dry run (rolled back) unless `--apply` is given.

    ```bash
    cd apps/backend
    DATABASE_URL=<write-capable url> pnpm tsx src/merge-events-by-slug.ts \
      --winner <slug> --loser <slug> [--loser <slug> ...] --moderator-id <users.id> [--apply]
    ```

3. **Choose the winner** as the event holding the *main* schedule (the race day), not the deadline post. A loser's schedules are copied onto the winner as non-main, its posts are linked to the winner, favorites, reports and calendar entries are repointed, and the loser's slug becomes an alias, so old links still resolve. The winner keeps its own primary post, name and organizer.

## Draining the moderator backlog

`drain-event-match-backlog.ts` re-evaluates every **pending** `event_match_candidates` row with the exact decision ingestion uses now (it shares `decideMatchTier`) and accepts the ones ingestion would auto-link, through `mergeEvents()` with the existing event as winner, as the moderator accept button does. Each merge is journaled in `event_merges` and reversible with `undoEventMerge`. A pair whose events were merged or deleted since is skipped as stale. Re-running is safe: accepted rows are no longer pending.

```bash
cd apps/backend
# 1. Read-only evaluation: nothing is merged, works with the read-only prod role.
DATABASE_URL=<read-only url> pnpm tsx src/drain-event-match-backlog.ts --moderator-id <users.id> --evaluate-only
# 2. Dry run on a write-capable url: the real merges, rolled back. Prints counts and every pair.
DATABASE_URL=<write-capable url> pnpm tsx src/drain-event-match-backlog.ts --moderator-id <users.id>
# 3. After a moderator has spot-checked the printed pairs: commit all-or-nothing.
DATABASE_URL=<write-capable url> pnpm tsx src/drain-event-match-backlog.ts --moderator-id <users.id> \
  [--exclude <suggestion id> ...] --apply
```

A pair is printed with its suggestion id, `promoted` or `scored-high`, score, name similarity, day difference, and which signals fired. **Spot-check the list before `--apply`**: there is almost no rejection ground truth (only a handful of moderator decisions exist, all accepts), so precision is unmeasured. `--exclude` leaves a suggestion in the queue. The tagged-organizer-handle leg of the organizer signal is not stored, so the drain can only under-link relative to ingestion, never over-link.

## Re-extract preview (moderators)

Shows what the **current** extraction and dedup logic would do with a post, and writes nothing. Spine **AD-40**.

*   **Where:** on an event page, the moderator-only "Source posts (moderator)" panel has a **Re-extract** button per source post (it appears even for an event with a single source post). For a post with no event, use **Moderator → Tools → Re-extract** and paste the post URL.
*   **What it shows:** the post's grouping reason; every extracted event with its schedules and links; each event's dedup result (would auto-link, would queue for review, low match, or no similar event) with the score and the closest existing event; and whether ingestion would skip the item because the post's slot already has an event.
*   **Why a re-run does not change existing events:** ingestion skips an item whose `(post, extraction_ordinal)` already has an event. The preview reports that case instead of acting on it. To change an existing event, merge it (above) or edit it as a moderator.
*   **Rescrape:** only when the post's caption is not stored, and at most once per 10 minutes per URL (scraper credit). A stored caption is never refetched. The caption is held only in the extraction job, which blanks it when it ends; it is never written to the post. A URL not in the database is scraped and previewed without an account signal, and is not stored.
*   **Limits:** no geocoding or timezone lookups, so the venue signal is the location text only. Uses the same Gemini key rules as the correction flow: a post already in the database falls back to shared subscriber keys; an unknown URL needs the moderator's own key.

## Gotchas

*   `events.links` is a jsonb **string** holding the array in production (drizzle/postgres.js double-encoding; all rows with links, checked 2026-10-18). Drizzle's read path unwraps it; raw SQL must use `#>> '{}'`.
*   The re-extract preview reports the same tier ingestion would act on, so a promoted pair shows as "would auto-link".
*   Changing any weight, threshold, window or tier rule is a spine amendment, and must update the diagram and its status section in the same change (see `_bmad-output/project-context.md`).
*   Matching is best-effort. A duplicate it misses (a concurrent ingestion, a post with no usable date) is resolved by a moderator merge. No distributed lock exists by design.
