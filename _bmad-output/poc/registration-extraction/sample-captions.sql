-- Stratified caption sample for hand-labelling (handoff 7A). READ ONLY.
-- Output: one JSON object per line. The result holds REAL captions: run-sample.sh writes it only to the
-- gitignored private/ folder. Deterministic: the order inside a stratum is md5(post id), no random().
BEGIN READ ONLY;
SET LOCAL statement_timeout = '90s';
WITH active_ev AS (
  SELECT e.id, e.event_name, e.has_private_contact,
         CASE WHEN jsonb_typeof(e.links) = 'string' THEN (e.links #>> '{}')::jsonb ELSE e.links END AS links
  FROM events e WHERE e.deleted_at IS NULL AND e.merged_into_event_id IS NULL
), per_post AS (
  SELECT ep.post_id,
         count(DISTINCT a.id) AS n_events,
         bool_or(a.has_private_contact) AS any_private_contact,
         jsonb_agg(DISTINCT a.event_name) AS event_names,
         jsonb_agg(DISTINCT s.ticket_price) FILTER (WHERE s.ticket_price IS NOT NULL AND s.ticket_price <> '') AS ticket_prices,
         bool_or(coalesce(s.ticket_price,'') ~* '(vip|reguler|regular|early|presale|batch|tier|kategori|category|dewasa|anak)'
                 OR (length(coalesce(s.ticket_price,'')) - length(replace(lower(coalesce(s.ticket_price,'')), 'rp', ''))) / 2 >= 2) AS price_tiers,
         bool_or(a.links IS NOT NULL AND jsonb_typeof(a.links) = 'array' AND jsonb_array_length(a.links) > 0
                 AND a.links::text ~* '(regist|daftar|pendaftar|rsvp|tiket|ticket|reservasi|forms\.gle|bit\.ly)') AS has_reg_link,
         jsonb_agg(DISTINCT a.links) FILTER (WHERE a.links IS NOT NULL) AS links
  FROM event_posts ep
  JOIN active_ev a ON a.id = ep.event_id
  LEFT JOIN schedules s ON s.event_id = a.id
  GROUP BY ep.post_id
), flagged AS (
  SELECT p.id AS post_id, p.platform_post_id, p.published_at, p.content AS caption, p.image_url, pp.n_events, pp.any_private_contact,
         pp.event_names, pp.ticket_prices, pp.links, pp.price_tiers, pp.has_reg_link,
         (p.content ~ '(\+?62|\y0)[ .-]?8[0-9]{1,2}[ .-]?[0-9]{3,4}[ .-]?[0-9]{2,5}') AS phone,
         (p.content ~* '(daftar|pendaftaran|registrasi|register|rsvp|\ycp\y|contact|hubungi|konfirmasi|\ywa\y|whatsapp|narahubung)') AS reg_cue,
         (p.content ~* 'wa\.me|api\.whatsapp\.com') AS wa_link,
         (p.content ~* '(hadiah|total hadiah|prize|doorprize|door prize|berhadiah|\d+ ?(juta|jt)\y)') AS prize,
         (p.content ~* '(diskon|discount|potongan|cashback|promo|\y\d{1,2} ?%|voucher)') AS promo,
         (p.content ~* '(link in bio|linktr\.ee|bit\.ly|forms\.gle|docs\.google\.com/forms|tinyurl|s\.id/|lynk\.id)') AS link_hint
  FROM posts p JOIN per_post pp ON pp.post_id = p.id
  WHERE p.content IS NOT NULL AND length(p.content) BETWEEN 40 AND 4000
), staged AS (
  SELECT *,
    CASE
      WHEN n_events >= 2 AND phone                              THEN '1_multi_event_phone'
      WHEN wa_link                                              THEN '2_wa_link'
      WHEN phone AND reg_cue AND n_events = 1                   THEN '3_phone_with_reg_cue'
      WHEN phone AND NOT reg_cue AND n_events = 1               THEN '4_phone_no_cue'
      WHEN prize AND NOT phone                                  THEN '5_prize_competition'
      WHEN promo AND NOT phone AND NOT prize                    THEN '6_promo_discount'
      WHEN (link_hint OR has_reg_link) AND NOT phone            THEN '7_link_only'
      WHEN price_tiers AND NOT phone                            THEN '8_price_tiers'
      WHEN NOT phone AND NOT reg_cue AND NOT prize AND NOT promo AND NOT link_hint AND NOT has_reg_link THEN '9_control_none'
    END AS stratum
  FROM flagged
), ranked AS (
  SELECT *, row_number() OVER (PARTITION BY stratum ORDER BY md5(post_id::text)) AS rn FROM staged WHERE stratum IS NOT NULL
)
SELECT row_to_json(t) FROM (
  SELECT stratum, rn, post_id, platform_post_id, published_at, n_events, any_private_contact, price_tiers, event_names, ticket_prices, links, image_url, caption
  FROM ranked
  WHERE rn <= CASE stratum
      WHEN '1_multi_event_phone' THEN 8
      WHEN '2_wa_link' THEN 8
      WHEN '3_phone_with_reg_cue' THEN 18
      WHEN '4_phone_no_cue' THEN 8
      WHEN '5_prize_competition' THEN 10
      WHEN '6_promo_discount' THEN 10
      WHEN '7_link_only' THEN 10
      WHEN '8_price_tiers' THEN 6
      WHEN '9_control_none' THEN 8 END
  ORDER BY stratum, rn
) t;
ROLLBACK;
