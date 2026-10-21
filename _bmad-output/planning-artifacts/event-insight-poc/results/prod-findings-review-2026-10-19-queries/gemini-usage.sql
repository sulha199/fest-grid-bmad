-- How much of the Gemini daily quota does live traffic use? (Flash Lite limits stated by the owner on 2026-10-19: 500 requests/day, 20/minute; non-lite Flash 20/day.)
-- extraction_audit_logs holds one row per post extraction (AD-29) with the model used; it does NOT count the other Gemini calls (account classification,
-- profile enrichment, location inference, the AI filter) so read it as a LOWER bound of live use. Counts only, last 14 days.
select created_at::date as day, gemini_model, count(*) as extraction_calls from extraction_audit_logs where created_at >= current_date - 14 group by 1, 2 order by 1 desc, 2;

select created_at::date as day, count(*) as ai_filter_rows from ai_event_filters where created_at >= current_date - 14 group by 1 order by 1 desc;

select created_at::date as day, status, count(*) as manual_extraction_jobs from manual_extraction_jobs where created_at >= current_date - 14 group by 1, 2 order by 1 desc, 2;
