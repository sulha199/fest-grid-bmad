-- Manual repair, 2026-10-26 (BUG-081 follow-up). Run as a role that can write social_media_account_profiles.
--
-- Fixes the 9 rows the automated repair deliberately did not touch:
--   * 7 subscribed NUMERIC-keyed rows whose username was relabelled to another account's handle by the old
--     profile backfill. Evidence for each: (1) 40 days of stored Apify output pair the row's numeric
--     account_id with the RESTORED handle and never with the current label; (2) the row's own scraper runs
--     show it was first scraped as the restored handle, then flipped to the wrong one.
--   * 2 handle-keyed rows whose display_name is still another account's (username is already correct).
--
-- Each UPDATE is guarded by account_id AND the expected current username, so a row that already changed is
-- skipped, and re-running is harmless. Old values are kept in a backup table and in account_profile_repairs.

-- ---- PREFLIGHT (read-only): all 9 rows should show the "current" values listed in the VALUES below ----------
SELECT id, account_id, username, display_name
FROM social_media_account_profiles
WHERE id IN (
  '0587b45b-cdb1-4ffd-b0f5-c86542bb8c2b','f63e8569-c6dc-42e8-993d-c4b0087501a9','ac5e8195-da5d-41bc-aedd-8e31a1670bce',
  'ce78a35c-78f1-46e2-8612-d6e1d81d6362','a7bd7c22-25db-47d1-8488-43bfd4b85e80','7d2bb351-ef70-4a28-ba23-7639ad1e023c',
  'd91c89fc-89f9-4e9c-aa6b-bf62d08074d1','f1fc1370-6342-4532-bf05-f43218c4e01d','911439c5-8490-4fd3-b5e4-88777d1b8107')
ORDER BY account_id;

-- ---- REPAIR ---------------------------------------------------------------------------------------------------
BEGIN;

CREATE TABLE IF NOT EXISTS public.manual_backup_profiles_20261026 (LIKE public.social_media_account_profiles);
INSERT INTO public.manual_backup_profiles_20261026
SELECT * FROM public.social_media_account_profiles
WHERE id IN (
  '0587b45b-cdb1-4ffd-b0f5-c86542bb8c2b','f63e8569-c6dc-42e8-993d-c4b0087501a9','ac5e8195-da5d-41bc-aedd-8e31a1670bce',
  'ce78a35c-78f1-46e2-8612-d6e1d81d6362','a7bd7c22-25db-47d1-8488-43bfd4b85e80','7d2bb351-ef70-4a28-ba23-7639ad1e023c',
  'd91c89fc-89f9-4e9c-aa6b-bf62d08074d1','f1fc1370-6342-4532-bf05-f43218c4e01d','911439c5-8490-4fd3-b5e4-88777d1b8107');

WITH fix(profile_id, account_id, cur_username, new_username, new_display, note) AS (VALUES
  -- numeric-keyed: restore the handle that owns the row's numeric ID
  ('0587b45b-cdb1-4ffd-b0f5-c86542bb8c2b'::uuid, '4842911995',  'masjidmuhajirinnitikan', 'jogjakajian',       'Info Kajian Jogja .JogjaKajian',  'vendor pairs 4842911995 with jogjakajian; first scraped as jogjakajian 10-16, flipped by 10-20'),
  ('f63e8569-c6dc-42e8-993d-c4b0087501a9'::uuid, '63871958479', 'erafone.run',            'myrace.organizer', 'MyRace Sport Event Organizer',    'vendor pairs 63871958479 with myrace.organizer; first scraped as myrace.organizer 10-16, flipped by 10-19'),
  ('ac5e8195-da5d-41bc-aedd-8e31a1670bce'::uuid, '51650937119', 'gembirunloka',           'pinarak.jogja',    'Pinarak Jogja',                   'vendor pairs 51650937119 with pinarak.jogja; first scraped as pinarak.jogja 10-17, flipped by 10-19'),
  ('ce78a35c-78f1-46e2-8612-d6e1d81d6362'::uuid, '26701805141', 'kratonjogja.tourism',    'kratonjogja.event','Event Kraton Jogja',              'vendor pairs 26701805141 with kratonjogja.event; scraped as kratonjogja.event 10-17 to 10-23, flipped 10-23'),
  ('a7bd7c22-25db-47d1-8488-43bfd4b85e80'::uuid, '60917678289', 'serenapalm.studio',      'gik.ugm',          'GIK UGM',                         'vendor pairs 60917678289 with gik.ugm; first scraped as gik.ugm 10-16, flipped twice (gik_pjs, serenapalm.studio)'),
  ('7d2bb351-ef70-4a28-ba23-7639ad1e023c'::uuid, '6826151747',  'alam.artisan',           'infokonsermusik',  'INFO KONSER MUSIK INDONESIA',     'vendor pairs 6826151747 with infokonsermusik; scraped as infokonsermusik 10-19 to 10-23, flipped twice'),
  ('d91c89fc-89f9-4e9c-aa6b-bf62d08074d1'::uuid, '58769466456', 'liveproject_id',         'konserindonesia_', 'KONSERINDONESIA',                 'vendor pairs 58769466456 with konserindonesia_; scraped as konserindonesia_ until the 10-26 relabel'),
  -- handle-keyed: username already right, only the display name is another account's
  ('f1fc1370-6342-4532-bf05-f43218c4e01d'::uuid, 'lintaslari.id', 'lintaslari.id',       'lintaslari.id',    'lintaslari.id',                   'display name was laridijateng''s; no real name on file, set to the handle (edit by hand if you know it)'),
  ('911439c5-8490-4fd3-b5e4-88777d1b8107'::uuid, 'jogjarun.id',   'jogjarun.id',          'jogjarun.id',      'EVENT LARI JOGJA',                'display name was generun2026''s; vendor co-author entry names jogjarun.id "EVENT LARI JOGJA"')
),
old AS (
  SELECT p.id, p.username AS old_username, p.display_name AS old_display, f.account_id, f.new_username, f.new_display, f.note
  FROM social_media_account_profiles p
  JOIN fix f ON f.profile_id = p.id AND f.account_id = p.account_id AND f.cur_username = p.username
  WHERE (p.username, p.display_name) IS DISTINCT FROM (f.new_username, f.new_display)
),
upd AS (
  UPDATE social_media_account_profiles p
  SET username = o.new_username, display_name = o.new_display, updated_at = now()
  FROM old o WHERE p.id = o.id
  RETURNING p.id
)
INSERT INTO account_profile_repairs (profile_id, repair_kind, before, after, evidence, performed_by)
SELECT o.id, 'MANUAL_LABEL_RESTORE',
       jsonb_build_object('username', o.old_username, 'displayName', o.old_display),
       jsonb_build_object('username', o.new_username, 'displayName', o.new_display),
       jsonb_build_object('accountId', o.account_id, 'note', o.note),
       'manual:sql-2026-10-26'
FROM old o JOIN upd u ON u.id = o.id;

-- Verify before committing: expect the 9 rows below with the NEW values.
SELECT id, account_id, username, display_name FROM social_media_account_profiles
WHERE id IN (SELECT profile_id FROM account_profile_repairs WHERE repair_kind = 'MANUAL_LABEL_RESTORE' AND performed_by = 'manual:sql-2026-10-26')
ORDER BY account_id;

COMMIT;   -- if the rows above look wrong, run ROLLBACK; instead (when executing statement by statement)

-- ---- UNDO (only if needed): puts the 9 rows back exactly as they were ---------------------------------------------
-- UPDATE social_media_account_profiles p SET username = b.username, display_name = b.display_name, updated_at = now()
-- FROM manual_backup_profiles_20261026 b WHERE b.id = p.id;
