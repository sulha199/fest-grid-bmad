-- Fixture for recall-classes.sql and recall-class4-stubs.sql. Scratch databases ONLY (it creates tables named events, schedules, event_posts and
-- event_match_candidates): load into an empty throwaway database, then run the two query files. Expected:
--   recall-classes.sql      -> class 2: 1 pair (Pasar Seni), class 4: 1 pair (Jazz Night), 0 in the candidate list
--   recall-class4-stubs.sql -> 'both full', 'no shared link': 1 pair
-- Jazz Night has the LARGER id on the OLDER event; the first version of the query took the created_at of the larger-id event as "the later one"
-- and put this pair in class 2 (found on the production run of 2026-10-19: two pairs in class 2 had a candidate row, which cannot happen).
create table events (id uuid primary key, source_social_media_account_id text, event_name text, created_at timestamptz, deleted_at timestamptz, merged_into_event_id uuid, detail_level text default 'full', links jsonb);
create table schedules (id uuid primary key default gen_random_uuid(), event_id uuid, event_start_date date);
create table event_posts (event_id uuid, post_id uuid, primary key (event_id, post_id));
create table event_match_candidates (id uuid primary key default gen_random_uuid(), event_id uuid, candidate_event_id uuid, created_at timestamptz);
-- pair P: larger id (…02) is the OLDER event (30 days ago), smaller id (…01) is NEWER (now); first candidate was 10 days ago (elsewhere) => the matcher was running when the newer event arrived => class 4
insert into events (id, source_social_media_account_id, event_name, created_at) values
 ('00000000-0000-0000-0000-000000000001','A','Jazz Night', now()),
 ('00000000-0000-0000-0000-000000000002','A','Jazz Night', now() - interval '30 days'),
-- pair Q: both created before the first candidate => class 2
 ('00000000-0000-0000-0000-000000000011','B','Pasar Seni', now() - interval '20 days'),
 ('00000000-0000-0000-0000-000000000012','B','Pasar Seni', now() - interval '25 days'),
-- unrelated events that give the first candidate row
 ('00000000-0000-0000-0000-000000000021','Z','Other A', now() - interval '10 days'),
 ('00000000-0000-0000-0000-000000000022','Z','Other B', now() - interval '10 days');
insert into schedules (event_id, event_start_date) select id, current_date + 3 from events;
insert into event_match_candidates (event_id, candidate_event_id, created_at) values ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000021', now() - interval '10 days');
