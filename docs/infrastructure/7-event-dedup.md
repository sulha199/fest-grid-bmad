# 7. Event Dedup

*   **What it does:** Stops one real-world event from becoming several `events` rows when it is posted more than once (a hype post, a registration reminder, a medal reveal, a roundup). Runs on the write path only, inside the ingestion Lambda, after extraction and before the insert.
*   **Authority:** Architecture Spine **AD-30 Rule 7** (matching) and **Rule 9** (merge). The flow is drawn in `_bmad-output/planning-artifacts/diagrams/event-dedup-flow.html`. This page is the operator's summary; the spine wins on any disagreement.
*   **Code:** `findMatchingEvent` (`apps/backend/src/lib/events/match-event-to-existing.ts`), scoring and thresholds (`packages/domain/src/events/match-scoring.ts`), merge and undo (`apps/backend/src/lib/events/merge-events.ts`), operator merge (`apps/backend/src/merge-events-by-slug.ts`).

## How a new event is matched

1. **Idempotency.** `(post, extraction_ordinal)` already represented → skip. Never reaches matching.
2. **Candidates.** Active events (not deleted, not merged, not already linked to this post) whose name is trigram-similar (`> 0.3`), and that either have a schedule within **±2 days** of a new schedule, or share a normalized event link with the new item and have a schedule within **±90 days**. At most 20 rows.
3. **Score.** Organizer 0.40 + shared link 0.20 + mean(name similarity, date proximity) × 0.25 + venue 0.15. **High ≥ 0.75, mid ≥ 0.45, low below.** Roundup and curator posts get no organizer weight from the posting account.
4. **Tier outcome.**
    * **High:** enrich the existing event and promote the better primary post. No new row.
    * **Mid:** insert as its own event and queue one `event_match_candidates` row. A moderator accepts (a merge) or rejects it.
    * **Low:** plain new event.
5. A candidate with **no schedule within ±2 days** (admitted only by the shared link) is capped at **mid**. It is never auto-linked.

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

## Gotchas

*   `events.links` is a jsonb **string** holding the array in production (drizzle/postgres.js double-encoding; all rows with links, checked 2026-10-18). Drizzle's read path unwraps it; raw SQL must use `#>> '{}'`.
*   Changing any weight, threshold, window or tier rule is a spine amendment, and must update the diagram and its status section in the same change (see `_bmad-output/project-context.md`).
*   Matching is best-effort. A duplicate it misses (a concurrent ingestion, a post with no usable date) is resolved by a moderator merge. No distributed lock exists by design.
