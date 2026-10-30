-- Round 4 ask 3b: the same events as event-names-for-series-score.sql (same `row_ref`, so the two results join), with the tag-like data each event carries,
-- to test whether hashtags make series grouping better than the name alone. Read-only, a single SELECT.
--
-- Hashtags live on the POST (posts.hashtags), not on the event: an event sees the hashtags of its primary post (events.post_id). So
--   `events_in_post` > 1 means a roundup or multi-event post, whose hashtags describe several events and cannot be trusted for any one of them.
-- `types` and `categories` are the event's own AI-assigned arrays (coarse). Hashtags are printed lower-cased, space-separated, cut to 300 characters.
-- Public caption text only: no caption body, no handle, no link, no account id. Same scope as the names query (not deleted, not merged).
-- To get a file: export the result as CSV (Supabase SQL editor: Results > Download CSV). About 1,400 rows.

select left(e.id::text, 8)                                                   as row_ref,
       coalesce(cardinality(p.hashtags), 0)                                  as hashtag_count,
       left(lower(coalesce(array_to_string(p.hashtags, ' '), '')), 300)      as hashtags,
       (select count(*) from events e2
         where e2.post_id = e.post_id and e2.deleted_at is null
           and e2.merged_into_event_id is null)                              as events_in_post,
       array_to_string(e.categories, ' ')                                    as categories,
       array_to_string(e.types, ' ')                                         as types
from events e
left join posts p on p.id = e.post_id
where e.deleted_at is null and e.merged_into_event_id is null
order by e.id;
