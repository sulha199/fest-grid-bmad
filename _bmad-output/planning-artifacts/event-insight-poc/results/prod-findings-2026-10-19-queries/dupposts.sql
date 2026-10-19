\echo === REBORN umbrella posts: identity fields ===
select left(p.id::text,8) post, left(p.platform_post_id,14) platform_post_id, left(coalesce(p.account_id::text,''),22) account_id, p.platform_post_type ptype,
  left(regexp_replace(coalesce(p.post_url,''),'^https?://(www\.)?',''),34) post_url, p.published_at::date pub, p.created_at::date created, p.scraper_actor_run_id is not null via_scraper
from posts p where p.content ~* 'celebrating 8th anniversary sleman city hall' order by p.created_at;
\echo === same platform_post_id on >1 post row (whole table) ===
select count(*) dup_groups, sum(n) rows_in_groups, sum(n-1) redundant from (select platform_post_id, count(*) n from posts where platform_post_id is not null group by 1 having count(*)>1) t;
\echo === same normalized caption (first 120 chars) on >1 post row ===
select count(*) dup_groups, sum(n) rows_in_groups, sum(n-1) redundant from (select left(lower(content),120) k, count(*) n from posts where content is not null and length(content)>40 group by 1 having count(*)>1) t;
\echo === total posts / posts with owner_username null ===
select count(*) posts, count(*) filter (where owner_username is null) no_owner, count(*) filter (where scraper_actor_run_id is null) no_scraper_run from posts;
