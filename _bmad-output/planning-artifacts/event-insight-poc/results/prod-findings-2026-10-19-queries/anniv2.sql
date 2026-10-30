select coalesce(owner_username,'(none)') owner, left(id::text,8) post, published_at::date pub,
  regexp_replace(substring(content from '(?i).{0,70}8th\s+anniversary.{0,50}'),E'[\n\r]+',' ','g') snippet
from posts where content ~* '8th\s+anniversary' and coalesce(owner_username,'') <> 'slemancityhall' order by owner_username nulls last, published_at;
\echo === children still unattached by keyword: SCH-family events whose post/event text never says 8th anniversary ===
with fam as (select e.id, e.event_name from events e where e.source_social_media_account_id='slemancityhall'
  and e.event_name ~* '^SCH |circus|pongki|line dance|zumba|fireworks|creative (market|workshop)'),
f as (select fam.*, (fam.event_name ~* '8th\s+anniversary' or exists (select 1 from events x where x.id=fam.id and x.description ~* '8th\s+anniversary')
   or exists (select 1 from event_posts ep join posts p on p.id=ep.post_id where ep.event_id=fam.id and p.content ~* '8th\s+anniversary')) has_kw from fam)
select count(*) family_events, count(*) filter (where has_kw) with_keyword, count(*) filter (where not has_kw) without_keyword from f;
