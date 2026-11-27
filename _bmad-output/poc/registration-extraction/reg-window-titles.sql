-- POC: how many stored schedules are registration / ticket-sale windows, judged by title alone (read-only; aggregates and public titles only).
BEGIN READ ONLY; SET LOCAL statement_timeout='60s';
with c as (
  select s.event_id, s.is_main_schedule, s.title, s.event_start_date, s.event_end_date,
    (s.title ~* '(pendaftaran|registrasi|registration|register|daftar|open recruitment|early ?bird|presale|pre-sale|pre sale|flash sale|tiket|ticket|call for|open call|penjualan|gelombang|batch)'
     and not s.title ~* '(ulang|re-?regist|on-?site|check-?in|redemption|penukaran|gate|promo|umurmu|^day [0-9]|hari [0-9]|event day|lineup)'
     and length(s.title) <= 70) as is_win
  from schedules s join events e on e.id = s.event_id where e.deleted_at is null and e.merged_into_event_id is null),
per_event as (select event_id, count(*) n, count(*) filter (where is_win) n_win, bool_or(is_win and is_main_schedule) win_is_main from c group by 1)
select 'schedules', count(*), count(*) filter (where is_win) from c;
select 'events_with_window', count(*) filter (where n_win > 0), count(*) filter (where n_win > 0 and n_win < n), count(*) filter (where n_win = n), count(*) filter (where win_is_main and n_win < n) from (
  select event_id, count(*) n, count(*) filter (where is_win) n_win, bool_or(is_win and is_main_schedule) win_is_main from (
    select s.event_id, s.is_main_schedule,
     (s.title ~* '(pendaftaran|registrasi|registration|register|daftar|open recruitment|early ?bird|presale|pre-sale|pre sale|flash sale|tiket|ticket|call for|open call|penjualan|gelombang|batch)'
      and not s.title ~* '(ulang|re-?regist|on-?site|check-?in|redemption|penukaran|gate|promo|umurmu|^day [0-9]|hari [0-9]|event day|lineup)' and length(s.title) <= 70) is_win
    from schedules s join events e on e.id = s.event_id where e.deleted_at is null and e.merged_into_event_id is null) z group by 1) y;
ROLLBACK;
