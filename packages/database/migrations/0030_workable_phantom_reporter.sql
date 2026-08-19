CREATE TABLE IF NOT EXISTS "parser_version_registry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"description" text,
	"source_file" text,
	"deployed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parser_version_registry_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unprocessed_scraper_payloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"validation_error" jsonb NOT NULL,
	"context" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_parser_versions_version" ON "parser_version_registry" ("version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_parser_versions_active" ON "parser_version_registry" ("is_active" DESC, "version" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_unprocessed_payloads_created_desc" ON "unprocessed_scraper_payloads" ("created_at" DESC) WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_unprocessed_payloads_source" ON "unprocessed_scraper_payloads" USING GIN ("context") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_unprocessed_payloads_cleanup" ON "unprocessed_scraper_payloads" ("created_at") WHERE "deleted_at" IS NULL;