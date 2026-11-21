-- POC: stored schedule titles of active events, one JSON row per schedule (read-only; output goes to private/, gitignored).
BEGIN READ ONLY; SET LOCAL statement_timeout='60s';
select json_build_object('e', s.event_id, 'main', s.is_main_schedule, 't', s.title, 's', s.event_start_date, 'x', s.event_end_date)
from schedules s join events e on e.id = s.event_id where e.deleted_at is null and e.merged_into_event_id is null;
ROLLBACK;
