-- Throwaway fixture for pin-trust-sample.sql: a minimal `schedules` with objects, double-encoded strings and rows with no pin.
create table schedules (id uuid primary key default gen_random_uuid(), location text, latitude float8, longitude float8, location_details jsonb);
insert into schedules (location, latitude, longitude, location_details)
select 'Venue ' || g, -7.78 + g * 0.001, 110.37, case when g % 3 = 0 then to_jsonb(json_build_object('confidence', 0.9, 'matchType', 'full_match', 'formattedAddress', 'Yogyakarta, Indonesia', 'city', 'Yogyakarta', 'countryCode', 'id')::text)
                                                      else json_build_object('confidence', (g % 10) / 10.0, 'matchType', case when g % 2 = 0 then 'full_match' else 'match_by_street' end, 'formattedAddress', 'Somewhere ' || g, 'countryCode', 'id')::jsonb end
from generate_series(1, 40) g;
insert into schedules (location, latitude, longitude, location_details)
select 'Abroad ' || g, 37.0 + g, -97.0, json_build_object('confidence', 0.0, 'matchType', 'full_match', 'formattedAddress', 'Texas', 'countryCode', 'us')::jsonb from generate_series(1, 6) g;
insert into schedules (location, latitude, longitude, location_details) values ('No pin', null, null, null), ('Pin without details', -7.8, 110.4, null);
