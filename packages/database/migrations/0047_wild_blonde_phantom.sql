CREATE TABLE IF NOT EXISTS "scraper_provider_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"consecutive_failure_days" integer DEFAULT 0 NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_alert_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scraper_provider_health_provider_unique" UNIQUE("provider")
);
