DO $$ BEGIN
 CREATE TYPE "public"."parser_version_source" AS ENUM('APIFY', 'BRIGHTDATA', 'GEMINI');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "parser_version_registry" ADD COLUMN "source" "parser_version_source";
--> statement-breakpoint
-- parser_version_registry has never had any production data -- it was previously only
-- ever populated by the dev/test seed script. The scraping pipeline's real parser
-- versions are hardcoded string literals (brightdata-record-mapper.ts, instagram-
-- adapter.ts) that were never registered here, so the moderator "Reprocess" feature's
-- version lookup has always failed in production regardless of what version string was
-- entered. Backfill the two versions actually in use so reprocessPayload has real data
-- to validate against.
INSERT INTO "parser_version_registry" ("version", "description", "source_file", "source", "is_active")
VALUES
  ('3.4g', 'Bright Data record-to-post field mapping', 'brightdata-record-mapper.ts', 'BRIGHTDATA', true),
  ('3.4m', 'Apify actor-selection field mapping', 'instagram-adapter.ts', 'APIFY', true)
ON CONFLICT (version) DO NOTHING;