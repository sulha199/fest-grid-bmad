select "events"."id", "events"."event_name", "events"."slug", false, (SELECT count(*) FROM favorites WHERE favorites.event_id = "events"."id" AND favorites.deleted_at IS NULL), "events"."location", "events"."types", "events"."categories", "events"."post_id", "posts"."image_url", "posts"."durable_image_url", "posts"."durable_thumbnail_url", "posts"."image_url_expires_at", "posts"."video_url", "posts"."post_url", "posts"."original_post_url", "social_media_account_profiles"."is_image_storage_opted_in" from "events" left join "schedules" on ("events"."id" = "schedules"."event_id" and "schedules"."is_main_schedule" = $1) left join "posts" on "events"."post_id" = "posts"."id" left join "social_media_account_profiles" on "posts"."account_id" = "social_media_account_profiles"."id" where (EXISTS (
        SELECT 1 FROM "schedules"
        WHERE "schedules"."event_id" = "events"."id"
          AND daterange("schedules"."event_start_date", COALESCE("schedules"."event_end_date", "schedules"."event_start_date"), '[]')
              && daterange($2::date, NULL, '[]')
          
          AND (
            "schedules"."applicable_days_of_week" IS NULL
            OR cardinality("schedules"."applicable_days_of_week") = 0
            OR EXISTS (
              SELECT 1 FROM unnest("schedules"."applicable_days_of_week") AS aw(code)
              WHERE MOD(
                (CASE aw.code
                  WHEN 'SUN' THEN 0 WHEN 'MON' THEN 1 WHEN 'TUE' THEN 2 WHEN 'WED' THEN 3
                  WHEN 'THU' THEN 4 WHEN 'FRI' THEN 5 WHEN 'SAT' THEN 6 END)
                - EXTRACT(DOW FROM GREATEST("schedules"."event_start_date", $3::date))::int + 7, 7
              ) <= (
                LEAST(COALESCE("schedules"."event_end_date", "schedules"."event_start_date"), COALESCE(NULL, COALESCE("schedules"."event_end_date", "schedules"."event_start_date")))
                - GREATEST("schedules"."event_start_date", $4::date)
              )
            )
          )
        
      ) and "events"."deleted_at" is null) order by 
            COALESCE(
              (SELECT s2.event_start_date FROM schedules s2
                WHERE s2.event_id = "events"."id"
                  AND COALESCE(s2.event_end_date, s2.event_start_date) >= $5
                ORDER BY s2.event_start_date ASC, s2.event_start_time ASC NULLS LAST
                LIMIT 1),
              (SELECT s3.event_start_date FROM schedules s3
                WHERE s3.event_id = "events"."id" AND s3.is_main_schedule = true
                ORDER BY s3.event_start_date ASC, s3.event_start_time ASC NULLS LAST
                LIMIT 1),
              (SELECT s4.event_start_date FROM schedules s4
                WHERE s4.event_id = "events"."id"
                ORDER BY s4.event_start_date ASC, s4.event_start_time ASC NULLS LAST
                LIMIT 1)
            ) ASC
           limit $6
-- params: ["t","2026-10-18","2026-10-18","2026-10-18","2026-10-18","21"]
