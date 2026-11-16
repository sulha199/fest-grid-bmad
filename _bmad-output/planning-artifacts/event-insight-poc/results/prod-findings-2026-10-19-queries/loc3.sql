\echo === shape of the location_details string (first chars, length) ===
select left(location_details #>> '{}', 1) first_char, count(*), round(avg(length(location_details #>> '{}'))) avg_len, left(min(location_details #>> '{}'),70) sample from schedules where location_details is not null group by 1;
\echo === if JSON text inside: parse and count country codes ===
select coalesce((location_details #>> '{}')::jsonb->>'countryCode','(none)') cc, count(*) from schedules where location_details is not null and left(location_details #>> '{}',1)='{' group by 1 order by 2 desc limit 12;
