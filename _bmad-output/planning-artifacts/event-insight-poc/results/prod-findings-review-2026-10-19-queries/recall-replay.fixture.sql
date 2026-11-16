-- Fixture for recall-replay.sql and events-place-quality.sql. Scratch databases ONLY (it creates tables named events, posts, schedules, event_posts,
-- post_account_associations, event_match_candidates and the pg_trgm extension): load into an empty throwaway database, then run the two query files.
-- Expected recall-replay.sql (4 rows):
--   newer event is a full event      | low | 1 pair  | 0 candidates | organizer not matched (the newer post's account is not associated with the older event's posts) | mean 0.250
--   newer event is a full event      | mid | 1 pair  | 1 candidate  | organizer matched                                                                                  | mean 0.650
--   newer event is a stub            | low | 1 pair  | 0 candidates | same venue text, nothing else                                                                      | mean 0.400
--   newer event is a stub            | mid | 1 pair  | 0 candidates, should_have_been_candidate_but_is_not = 1 | shared link (0.25 + 0.20 = 0.45)                     | mean 0.450
-- Expected events-place-quality.sql: full/open/'4 no place at all' 4, full/past/'3 place text only' 1, stub/open/'2 pin, but untrusted' 2, stub/open/'4 no place at all' 2.
create extension pg_trgm;
create table events (id uuid primary key, source_social_media_account_id text, event_name text, created_at timestamptz, deleted_at timestamptz, merged_into_event_id uuid, detail_level text default 'full', post_id uuid, links jsonb);
create table posts (id uuid primary key, account_id uuid);
create table schedules (id uuid primary key default gen_random_uuid(), event_id uuid, event_start_date date, event_end_date date, location text, latitude float, longitude float, location_details jsonb);
create table event_posts (event_id uuid, post_id uuid, primary key (event_id, post_id));
create table post_account_associations (post_id uuid, account_id uuid);
create table event_match_candidates (id uuid primary key default gen_random_uuid(), event_id uuid, candidate_event_id uuid, created_at timestamptz);
-- helper ids
-- accounts: A1 = 'aaaaaaaa-...1' (organizer), K1 = curator
insert into posts (id, account_id) values
 ('10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001'),  -- P1 old post of A1
 ('10000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001'),  -- P2 new post of A1
 ('10000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000002'),  -- P3 old post (organizer X)
 ('10000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000009'),  -- P4 new post of a different account 9, full
 ('10000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000001'),  -- P5 old curator post
 ('10000000-0000-0000-0000-000000000006','c0000000-0000-0000-0000-000000000001'),  -- P6 new curator post
 ('10000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000001'),  -- P7
 ('10000000-0000-0000-0000-000000000008','c0000000-0000-0000-0000-000000000001');  -- P8
insert into post_account_associations values
 ('10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000002'),
 ('10000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000001');
-- Q1: full/full, same account via association, same day, no venue  -> 0.40 + 0.25 = 0.65 mid; IN candidates
-- Q2: full/full, new post account (9) not associated with the old event's posts -> 0.25 low; not in candidates
-- Q3: new event is a stub, same name/day, same venue text -> 0.25 + 0.15 = 0.40 low; not in candidates
-- Q4: new event is a stub, shared link, no venue -> 0.25 + 0.20 = 0.45 mid; not in candidates (should have been)
insert into events (id, source_social_media_account_id, event_name, created_at, detail_level, post_id, links) values
 ('e0000000-0000-0000-0000-0000000000a1','S-A','Jazz Night', now() - interval '10 days','full','10000000-0000-0000-0000-000000000001',null),
 ('e0000000-0000-0000-0000-0000000000a2','S-A','Jazz Night', now() - interval '1 day','full','10000000-0000-0000-0000-000000000002',null),
 ('e0000000-0000-0000-0000-0000000000b1','S-B','Pasar Seni', now() - interval '10 days','full','10000000-0000-0000-0000-000000000003',null),
 ('e0000000-0000-0000-0000-0000000000b2','S-B','Pasar Seni', now() - interval '1 day','full','10000000-0000-0000-0000-000000000004',null),
 ('e0000000-0000-0000-0000-0000000000c1','S-C','Lomba Lari', now() - interval '10 days','stub','10000000-0000-0000-0000-000000000005',null),
 ('e0000000-0000-0000-0000-0000000000c2','S-C','Lomba Lari', now() - interval '1 day','stub','10000000-0000-0000-0000-000000000006',null),
 ('e0000000-0000-0000-0000-0000000000d1','S-D','Bazar Buku', now() - interval '10 days','stub','10000000-0000-0000-0000-000000000007', to_jsonb('[{"url":"https://x.id/t"}]'::text)),
 ('e0000000-0000-0000-0000-0000000000d2','S-D','Bazar Buku', now() - interval '1 day','stub','10000000-0000-0000-0000-000000000008', '[{"url":"https://X.id/t/"}]'::jsonb),
 ('e0000000-0000-0000-0000-0000000000f1','S-F','Pameran Foto', now() - interval '10 days','full',null,null);
insert into event_posts select id, post_id from events where post_id is not null;
insert into schedules (event_id, event_start_date, event_end_date, location, latitude, longitude, location_details)
 select id, current_date + 3, null, case when event_name = 'Lomba Lari' then 'GOR Amongrogo' end, case when event_name='Lomba Lari' then -7.8 end, case when event_name='Lomba Lari' then 110.39 end,
        case when event_name='Jazz Night' then to_jsonb('{"confidence":0.9}'::text) when event_name='Lomba Lari' then '{"confidence":0.3}'::jsonb end
 from events where event_name <> 'Pameran Foto';
insert into schedules (event_id, event_start_date, location) values ('e0000000-0000-0000-0000-0000000000f1', current_date - 5, 'Hall');   -- past, text only
insert into event_match_candidates (event_id, candidate_event_id, created_at) values ('e0000000-0000-0000-0000-0000000000a2','e0000000-0000-0000-0000-0000000000a1', now() - interval '2 days');
