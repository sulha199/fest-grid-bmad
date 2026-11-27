-- Section 7A of the registration/CTA handoff (2026-11-20). READ ONLY. Aggregates only: no caption text,
-- no phone digits, no account names are selected anywhere in this file.
-- Run:  bash run-7a.sh   (reads PROD_READONLY_DATABASE_URL from .env.local, never prints it)
-- "active event" = not soft-deleted and not merged away. Temp objects are refused inside READ ONLY,
-- so each query repeats its CTEs.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '90s';

\echo '== Q1 events: total / active / has_private_contact'
SELECT count(*)                                                                  AS total,
       count(*) FILTER (WHERE deleted_at IS NULL AND merged_into_event_id IS NULL) AS active,
       count(*) FILTER (WHERE deleted_at IS NULL AND merged_into_event_id IS NULL AND has_private_contact) AS active_private_contact,
       count(*) FILTER (WHERE deleted_at IS NULL AND merged_into_event_id IS NULL AND contact_info IS NOT NULL AND length(contact_info) > 0) AS active_contact_info_set
FROM events;

\echo '== Q2a schedules: total vs registration-like title (active events)'
WITH s AS (
  SELECT sc.*, (sc.title ~* '(regist|daftar|pendaftar|rsvp|tiket|ticket|sign.?up|booking|reservasi|open ?recruitment|pre.?order|early bird|presale)') AS reg_like
  FROM schedules sc JOIN events e ON e.id = sc.event_id
  WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL
)
SELECT count(*) AS schedules, count(*) FILTER (WHERE reg_like) AS reg_like,
       count(*) FILTER (WHERE reg_like AND is_main_schedule) AS reg_like_and_main,
       count(*) FILTER (WHERE reg_like AND NOT is_main_schedule) AS reg_like_not_main,
       count(*) FILTER (WHERE title IS NULL OR title = '') AS no_title,
       count(DISTINCT event_id) FILTER (WHERE reg_like) AS events_with_reg_schedule
FROM s;

\echo '== Q2b events by number of registration-like schedules (active)'
WITH s AS (
  SELECT sc.event_id, (sc.title ~* '(regist|daftar|pendaftar|rsvp|tiket|ticket|sign.?up|booking|reservasi|open ?recruitment|pre.?order|early bird|presale)') AS reg_like
  FROM schedules sc JOIN events e ON e.id = sc.event_id
  WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL
), per AS (SELECT event_id, count(*) FILTER (WHERE reg_like) AS n, count(*) AS total FROM s GROUP BY event_id)
SELECT n AS reg_schedules_per_event, count(*) AS events FROM per GROUP BY n ORDER BY n;

\echo '== Q2c keyword breakdown of reg-like schedule titles (one count per keyword, titles not printed)'
WITH s AS (
  SELECT lower(sc.title) AS t FROM schedules sc JOIN events e ON e.id = sc.event_id
  WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL AND sc.title IS NOT NULL
)
SELECT kw, count(*) FROM s, unnest(ARRAY['registration','pendaftaran','daftar','rsvp','tiket','ticket','sign up','signup','booking','reservasi','pre-order','early bird','presale','open recruitment']) kw
WHERE t LIKE '%' || kw || '%' GROUP BY kw ORDER BY 2 DESC;

\echo '== Q2d reg-like schedule: language mix and shape (id/en/other keyword, has a time, has an end date)'
WITH s AS (
  SELECT sc.*, lower(sc.title) AS t FROM schedules sc JOIN events e ON e.id = sc.event_id
  WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL
    AND sc.title ~* '(regist|daftar|pendaftar|rsvp|tiket|ticket|sign.?up|booking|reservasi|pre.?order|early bird|presale)'
)
SELECT count(*) FILTER (WHERE t ~ '(daftar|pendaftar|tiket|reservasi)') AS id_keyword,
       count(*) FILTER (WHERE t ~ '(regist|ticket|sign.?up|booking|rsvp)' AND t !~ '(daftar|pendaftar|tiket|reservasi)') AS en_only_keyword,
       count(*) FILTER (WHERE event_start_time IS NOT NULL) AS has_start_time,
       count(*) FILTER (WHERE event_end_date IS NOT NULL AND event_end_date <> event_start_date) AS multi_day,
       count(*) FILTER (WHERE ticket_price IS NOT NULL AND ticket_price <> '') AS has_price,
       count(*) FILTER (WHERE event_start_date < current_date) AS already_past,
       count(*) AS total
FROM s;

\echo '== Q3a events.links: shape and registration-like links (active events; links is a double-encoded jsonb string)'
WITH l AS (
  SELECT e.id, CASE WHEN jsonb_typeof(e.links) = 'string' THEN (e.links #>> '{}')::jsonb ELSE e.links END AS arr
  FROM events e WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL AND e.links IS NOT NULL
), el AS (
  SELECT l.id, x->>'url' AS url, x->>'label' AS label
  FROM l, jsonb_array_elements(CASE WHEN jsonb_typeof(l.arr) = 'array' THEN l.arr ELSE '[]'::jsonb END) x
), tagged AS (
  SELECT *, (coalesce(label,'') ~* '(regist|daftar|pendaftar|rsvp|tiket|ticket|sign.?up|booking|reservasi|buy|beli|pesan|order)'
          OR coalesce(url,'')   ~* '(forms\.gle|docs\.google\.com/forms|tiket\.com|loket\.com|bit\.ly|tinyurl|linktr\.ee|lynk\.id|s\.id|bio\.link|wa\.me|api\.whatsapp)') AS reg_like,
          (coalesce(url,'') ~* '(wa\.me|api\.whatsapp\.com|whatsapp\.com)') AS is_wa_link
  FROM el
)
SELECT (SELECT count(*) FROM events WHERE deleted_at IS NULL AND merged_into_event_id IS NULL) AS active_events,
       (SELECT count(*) FROM l WHERE jsonb_array_length(CASE WHEN jsonb_typeof(arr)='array' THEN arr ELSE '[]'::jsonb END) > 0) AS events_with_links,
       count(DISTINCT id) FILTER (WHERE reg_like) AS events_with_reg_like_link,
       count(DISTINCT id) FILTER (WHERE is_wa_link) AS events_with_wa_link,
       count(*) AS link_elements, count(*) FILTER (WHERE reg_like) AS reg_like_elements
FROM tagged;

\echo '== Q3b events with 2+ distinct registration-like links'
WITH l AS (
  SELECT e.id, CASE WHEN jsonb_typeof(e.links) = 'string' THEN (e.links #>> '{}')::jsonb ELSE e.links END AS arr
  FROM events e WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL AND e.links IS NOT NULL
), el AS (
  SELECT l.id, x->>'url' AS url, x->>'label' AS label
  FROM l, jsonb_array_elements(CASE WHEN jsonb_typeof(l.arr) = 'array' THEN l.arr ELSE '[]'::jsonb END) x
), tagged AS (
  SELECT * FROM el WHERE coalesce(label,'') ~* '(regist|daftar|pendaftar|rsvp|tiket|ticket|sign.?up|booking|reservasi|buy|beli|pesan|order)'
), per AS (SELECT id, count(DISTINCT url) n FROM tagged GROUP BY id)
SELECT n AS distinct_reg_links, count(*) AS events FROM per GROUP BY n ORDER BY n;

\echo '== Q3c do registration schedules and registration links coexist on one event?'
WITH reg_sched AS (
  SELECT DISTINCT sc.event_id FROM schedules sc JOIN events e ON e.id = sc.event_id
  WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL
    AND sc.title ~* '(regist|daftar|pendaftar|rsvp|tiket|ticket|sign.?up|booking|reservasi|pre.?order|early bird|presale)'
), reg_link AS (
  SELECT DISTINCT l.id AS event_id FROM (
    SELECT e.id, CASE WHEN jsonb_typeof(e.links)='string' THEN (e.links #>> '{}')::jsonb ELSE e.links END arr
    FROM events e WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL AND e.links IS NOT NULL) l,
    jsonb_array_elements(CASE WHEN jsonb_typeof(l.arr)='array' THEN l.arr ELSE '[]'::jsonb END) x
  WHERE coalesce(x->>'label','') ~* '(regist|daftar|pendaftar|rsvp|tiket|ticket|sign.?up|booking|reservasi|buy|beli|pesan|order)'
)
SELECT (SELECT count(*) FROM reg_sched) AS with_reg_schedule, (SELECT count(*) FROM reg_link) AS with_reg_link,
       (SELECT count(*) FROM reg_sched r JOIN reg_link k USING (event_id)) AS with_both,
       (SELECT count(*) FROM reg_sched r WHERE NOT EXISTS (SELECT 1 FROM reg_link k WHERE k.event_id = r.event_id)) AS schedule_only;

\echo '== Q4a ticket_price distribution (all active-event schedules; one bucket per row)'
WITH s AS (
  SELECT sc.ticket_price p FROM schedules sc JOIN events e ON e.id = sc.event_id
  WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL
)
SELECT CASE
  WHEN p IS NULL OR trim(p) = '' THEN '0 null/empty'
  WHEN p ~* '^(gratis|free|free entry|free admission|bebas biaya|tanpa biaya|0|rp ?0)$' THEN '1 free (exact)'
  WHEN p ~* '(gratis|free)' AND p !~ '[0-9]' THEN '2 free (phrase)'
  WHEN p ~* '(gratis|free)' AND p ~ '[0-9]' THEN '3 free + number (tiered?)'
  WHEN p ~* '(tba|tbd|segera|soon|coming)' THEN '4 tba'
  WHEN (length(p) - length(replace(lower(p), 'rp', ''))) / 2 >= 2 OR p ~* '(vip|reguler|regular|early|presale|batch|tier|kategori|category|dewasa|anak)' THEN '6 multiple prices / tiers'
  WHEN p ~ '[0-9]' THEN '5 single amount-ish'
  ELSE '7 other text' END AS bucket, count(*)
FROM s GROUP BY 1 ORDER BY 1;

\echo '== Q4b events whose schedules carry 2+ distinct non-empty prices'
WITH per AS (
  SELECT sc.event_id, count(DISTINCT lower(trim(sc.ticket_price))) n
  FROM schedules sc JOIN events e ON e.id = sc.event_id
  WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL AND sc.ticket_price IS NOT NULL AND trim(sc.ticket_price) <> ''
  GROUP BY sc.event_id)
SELECT n AS distinct_prices, count(*) AS events FROM per GROUP BY n ORDER BY n;

\echo '== Q5 posts: caption presence, phone-like, wa mention (all posts with a stored caption; and those tied to an active event)'
WITH p AS (
  SELECT po.id, po.content,
    (po.content ~ '(\+?62|\y0)[ .-]?8[0-9]{1,2}[ .-]?[0-9]{3,4}[ .-]?[0-9]{2,5}')           AS phone_like,
    (po.content ~* 'wa\.me|api\.whatsapp\.com')                                               AS wa_link,
    (po.content ~* '\ywhatsapp\y|\ywa\y|\ywatsap\y|\yw\.?a\y')                                AS wa_word,
    (po.content ~* '(\+?62|\y0)[ .-]?8[0-9]{1,2}[ .-]?[0-9]{3,4}[ .-]?[0-9]{2,5}' AND po.content ~* '(wa|whatsapp|cp|contact|hubungi|info|konfirmasi|daftar|pendaftaran|reg)') AS phone_and_cue,
    EXISTS (SELECT 1 FROM event_posts ep JOIN events e ON e.id = ep.event_id WHERE ep.post_id = po.id AND e.deleted_at IS NULL AND e.merged_into_event_id IS NULL) AS has_active_event
  FROM posts po WHERE po.content IS NOT NULL AND length(po.content) > 0
)
SELECT count(*) AS posts_with_caption, count(*) FILTER (WHERE has_active_event) AS tied_to_active_event,
       count(*) FILTER (WHERE phone_like) AS phone_like, count(*) FILTER (WHERE phone_like AND has_active_event) AS phone_like_active,
       count(*) FILTER (WHERE wa_link) AS wa_link, count(*) FILTER (WHERE wa_word) AS wa_word,
       count(*) FILTER (WHERE phone_and_cue) AS phone_and_cue, count(*) FILTER (WHERE phone_and_cue AND has_active_event) AS phone_and_cue_active
FROM p;

\echo '== Q6 registration cues anywhere in captions of active-event posts'
WITH p AS (
  SELECT po.id, po.content FROM posts po
  WHERE po.content IS NOT NULL AND length(po.content) > 0
    AND EXISTS (SELECT 1 FROM event_posts ep JOIN events e ON e.id = ep.event_id WHERE ep.post_id = po.id AND e.deleted_at IS NULL AND e.merged_into_event_id IS NULL)
)
SELECT count(*) AS captions,
       count(*) FILTER (WHERE content ~* '(daftar|pendaftaran|registrasi|registration|register|\yrsvp\y)') AS reg_cue,
       count(*) FILTER (WHERE content ~* '(link in bio|linktr\.ee|bit\.ly|forms\.gle|docs\.google\.com/forms|tinyurl|s\.id/|lynk\.id)') AS link_hint,
       count(*) FILTER (WHERE content ~* '(\ycp\y|contact person|hubungi|narahubung|konfirmasi|informasi dan pendaftaran|info (dan|&) pendaftaran)') AS contact_cue,
       count(*) FILTER (WHERE content ~* '(\ycp\y|contact person|hubungi|narahubung|konfirmasi|\yinfo\y|daftar|pendaftaran|registrasi|reg)[^0-9]{0,60}(\+?62|\y0)[ .-]?8[0-9]{1,2}[ .-]?[0-9]{3,4}') AS cue_then_phone_60ch,
       count(*) FILTER (WHERE content ~* '(format|ketik|kirim)[^\n]{0,40}(nama|name)' OR content ~* '(nama|name)[ ]*[:/][^\n]{0,60}(asal|kelas|usia|umur|kategori|domisili|instansi)') AS message_template_hint
FROM p;

\echo '== Q7 prize / discount / promo cues in captions of active-event posts'
WITH p AS (
  SELECT po.id, po.content FROM posts po
  WHERE po.content IS NOT NULL AND length(po.content) > 0
    AND EXISTS (SELECT 1 FROM event_posts ep JOIN events e ON e.id = ep.event_id WHERE ep.post_id = po.id AND e.deleted_at IS NULL AND e.merged_into_event_id IS NULL)
)
SELECT count(*) AS captions,
       count(*) FILTER (WHERE content ~* '(hadiah|total hadiah|prize|doorprize|door prize|grand prize|berhadiah)') AS prize_cue,
       count(*) FILTER (WHERE content ~* '(\d+ ?(juta|jt)\y|rp ?\d{1,3}([.,]\d{3}){2,})') AS big_amount,
       count(*) FILTER (WHERE content ~* '(diskon|discount|potongan|cashback|promo|\y\d{1,2} ?%|voucher)') AS discount_cue,
       count(*) FILTER (WHERE content ~* '(gratis|free entry|free admission|\yfree\y|tanpa biaya|bebas biaya)') AS free_cue,
       count(*) FILTER (WHERE content ~* '(guest star|special guest|bintang tamu|featuring|\yfeat\y|headliner|line.?up)') AS guest_cue,
       count(*) FILTER (WHERE content ~* '(hadiah|prize|doorprize|diskon|discount|cashback|voucher|gratis|free entry|guest star|special guest|bintang tamu|\d+ ?(juta|jt)\y|\y\d{1,2} ?%)') AS any_highlight_cue
FROM p;

\echo '== Q8 multi-event posts (AD-30): events per post for posts that have a phone-like caption'
WITH pe AS (
  SELECT ep.post_id, count(DISTINCT ep.event_id) AS n_events
  FROM event_posts ep JOIN events e ON e.id = ep.event_id
  WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL GROUP BY ep.post_id
), p AS (
  SELECT po.id, pe.n_events,
         (po.content ~ '(\+?62|\y0)[ .-]?8[0-9]{1,2}[ .-]?[0-9]{3,4}[ .-]?[0-9]{2,5}') AS phone_like
  FROM posts po JOIN pe ON pe.post_id = po.id WHERE po.content IS NOT NULL AND length(po.content) > 0
)
SELECT CASE WHEN n_events >= 5 THEN '5+' ELSE n_events::text END AS events_per_post,
       count(*) AS posts, count(*) FILTER (WHERE phone_like) AS posts_with_phone_like
FROM p GROUP BY 1 ORDER BY 1;

\echo '== Q9 posts: how many extracted posts have no caption left (caption cleared after extraction)'
SELECT count(*) FILTER (WHERE is_extracted) AS extracted, count(*) FILTER (WHERE is_extracted AND (content IS NULL OR content = '')) AS extracted_no_caption,
       count(*) FILTER (WHERE is_extracted AND content IS NOT NULL AND content <> '') AS extracted_with_caption,
       count(*) FILTER (WHERE NOT is_extracted AND content IS NOT NULL AND content <> '') AS unextracted_with_caption
FROM posts;

\echo '== Q10 active events by source: any caption available / only image / event has no stored caption on any of its posts'
SELECT count(*) AS active_events,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM event_posts ep JOIN posts po ON po.id = ep.post_id WHERE ep.event_id = e.id AND po.content IS NOT NULL AND po.content <> '')) AS with_stored_caption,
       count(*) FILTER (WHERE has_private_contact AND NOT EXISTS (SELECT 1 FROM event_posts ep JOIN posts po ON po.id = ep.post_id WHERE ep.event_id = e.id AND po.content IS NOT NULL AND po.content <> '')) AS private_contact_without_caption
FROM events e WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL;

\echo '== Q11 has_private_contact vs phone-like in the caption (does the flag predict a phone in the text?)'
SELECT e.has_private_contact,
       count(*) AS events,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM event_posts ep JOIN posts po ON po.id = ep.post_id WHERE ep.event_id = e.id AND po.content ~ '(\+?62|\y0)[ .-]?8[0-9]{1,2}[ .-]?[0-9]{3,4}[ .-]?[0-9]{2,5}')) AS with_phone_like_caption
FROM events e WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL GROUP BY 1 ORDER BY 1;

\echo '== Q12 registration-flow shapes that live outside the caption text (active-event captions)'
WITH p AS (
  SELECT po.id, po.content FROM posts po
  WHERE po.content IS NOT NULL AND po.content <> ''
    AND EXISTS (SELECT 1 FROM event_posts ep JOIN events e ON e.id = ep.event_id WHERE ep.post_id = po.id AND e.deleted_at IS NULL AND e.merged_into_event_id IS NULL)
)
SELECT count(*) AS captions,
       count(*) FILTER (WHERE content ~* '(scan|pindai|memindai)[^\n]{0,30}(qr|barcode)|\yqr ?code\y') AS qr_mention,
       count(*) FILTER (WHERE content ~* '(link|tautan)[^\n]{0,12}(di )?(bio|profil|profile)') AS link_in_bio,
       count(*) FILTER (WHERE content ~* '(\ydm\y|direct message|inbox)') AS dm_mention,
       count(*) FILTER (WHERE content ~* '(chat\.whatsapp\.com|grup (wa|whatsapp)|group (wa|whatsapp)|gabung (grup|group))') AS wa_group,
       count(*) FILTER (WHERE content ~* '(rek(ening)?\.?|bank|bca|bri|bni|bsi|mandiri|gopay|ovo|dana|qris)[^\n]{0,30}\d{8,}') AS payment_account
FROM p;

\echo '== Q13 explicit message templates (a format the registrant must send), strict and loose'
WITH p AS (
  SELECT po.id, po.content FROM posts po
  WHERE po.content IS NOT NULL AND po.content <> ''
    AND EXISTS (SELECT 1 FROM event_posts ep JOIN events e ON e.id = ep.event_id WHERE ep.post_id = po.id AND e.deleted_at IS NULL AND e.merged_into_event_id IS NULL)
)
SELECT count(*) AS captions,
       count(*) FILTER (WHERE content ~* '\y(format|ketik)\y[^\n]{0,60}(pendaftaran|konfirmasi|daftar|registrasi|booking|nama)' OR content ~* '\y(ketik|kirim(kan)?)\y[^\n]{0,40}\y(nama|name)\y') AS template_strict,
       count(*) FILTER (WHERE content ~* '\y(format|template)\y') AS format_word_loose
FROM p;


\echo '== Q14 retention anchor (D2): active events by whether an end date can be computed from schedules'
WITH ev AS (
  SELECT e.id, e.has_private_contact,
         count(s.id) AS n_sched,
         max(coalesce(s.event_end_date, s.event_start_date)) AS last_day
  FROM events e LEFT JOIN schedules s ON s.event_id = e.id
  WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL GROUP BY e.id
)
SELECT count(*) AS active_events,
       count(*) FILTER (WHERE n_sched = 0) AS no_schedule_at_all,
       count(*) FILTER (WHERE last_day IS NULL AND n_sched > 0) AS schedules_without_date,
       count(*) FILTER (WHERE last_day >= current_date) AS not_ended_yet,
       count(*) FILTER (WHERE last_day < current_date) AS already_ended,
       count(*) FILTER (WHERE has_private_contact AND last_day >= current_date) AS private_contact_not_ended,
       count(*) FILTER (WHERE has_private_contact AND last_day < current_date) AS private_contact_already_ended
FROM ev;

\echo '== Q15 legacy registration-like schedules that a backfill (D6) must preserve: window still open or event not ended'
WITH r AS (
  SELECT sc.id, sc.event_id, coalesce(sc.event_end_date, sc.event_start_date) AS close_day
  FROM schedules sc JOIN events e ON e.id = sc.event_id
  WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL
    AND sc.title ~* '(regist|daftar|pendaftar|rsvp|tiket|ticket|sign.?up|booking|reservasi|pre.?order|early bird|presale)'
), last_day AS (
  SELECT s.event_id, max(coalesce(s.event_end_date, s.event_start_date)) d FROM schedules s GROUP BY s.event_id
)
SELECT count(*) AS reg_like_schedules,
       count(*) FILTER (WHERE r.close_day >= current_date) AS window_not_closed,
       count(*) FILTER (WHERE l.d >= current_date) AS event_not_ended,
       count(DISTINCT r.event_id) FILTER (WHERE l.d >= current_date) AS events_to_backfill
FROM r JOIN last_day l USING (event_id);

ROLLBACK;
