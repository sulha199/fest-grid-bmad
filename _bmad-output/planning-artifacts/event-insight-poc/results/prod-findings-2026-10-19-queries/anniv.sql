\echo === where "8th anniversary" (or "anniversary ke-8"/"ulang tahun ke-8") appears ===
select 'events.name' src, count(*) from events where event_name ~* '(8th|ke-?\s?8|delapan)\s+anniversary|anniversary\s+(ke-?\s?)?8|ulang tahun\s+(ke-?\s?)?(8|delapan)'
union all select 'events.description', count(*) from events where description ~* '(8th|ke-?\s?8|delapan)\s+anniversary|anniversary\s+(ke-?\s?)?8|ulang tahun\s+(ke-?\s?)?(8|delapan)'
union all select 'schedules.title', count(*) from schedules where title ~* '8th\s+anniversary'
union all select 'posts.content', count(*) from posts where content ~* '8th\s+anniversary'
union all select 'posts.title', count(*) from posts where title ~* '8th\s+anniversary'
union all select 'posts.hashtags', count(*) from posts where array_to_string(hashtags,' ') ~* '8th'
union all select 'accounts mentioning (distinct owner)', count(distinct owner_username) from posts where content ~* '8th\s+anniversary';
\echo === which accounts use the phrase (posts) ===
select coalesce(owner_username,'(none)') owner, count(*) posts from posts where content ~* '8th\s+anniversary' group by 1 order by 2 desc limit 10;
\echo === events from slemancityhall whose name/description carries 8th anniversary vs the SCH-family children ===
select left(e.event_name,48) ev, left(e.post_id::text,8) post,
  (e.event_name ~* '8th\s+anniversary') in_name, (coalesce(e.description,'') ~* '8th\s+anniversary') in_desc,
  exists (select 1 from event_posts ep join posts p on p.id=ep.post_id where ep.event_id=e.id and p.content ~* '8th\s+anniversary') linked_post_has_kw,
  (select min(event_start_date) from schedules s where s.event_id=e.id) d1
from events e where e.source_social_media_account_id='slemancityhall'
 and (e.event_name ~* '^SCH |reborn|8th|circus|pongki|line dance|zumba|fireworks|creative (market|workshop)|otomotif|bakmi|wayang|cipungland')
order by d1, ev;
