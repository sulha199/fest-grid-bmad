-- Every stored caption of a post tied to an active event, with the AI's private-contact flag. READ ONLY.
-- Output holds REAL captions: run-all-captions.sh writes it only to the gitignored private/ folder.
BEGIN READ ONLY; SET LOCAL statement_timeout='90s';
SELECT row_to_json(t) FROM (
  SELECT p.id AS post_id, p.content AS caption, count(DISTINCT e.id) AS n_events,
         bool_or(e.has_private_contact) AS flag, p.published_at
  FROM posts p
  JOIN event_posts ep ON ep.post_id = p.id
  JOIN events e ON e.id = ep.event_id AND e.deleted_at IS NULL AND e.merged_into_event_id IS NULL
  WHERE p.content IS NOT NULL AND p.content <> ''
  GROUP BY p.id
) t;
ROLLBACK;
