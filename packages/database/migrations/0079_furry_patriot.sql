CREATE TABLE IF NOT EXISTS "prompt_filter_rate_limits" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"window_start_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prompt_filter_rate_limits" ADD CONSTRAINT "prompt_filter_rate_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
