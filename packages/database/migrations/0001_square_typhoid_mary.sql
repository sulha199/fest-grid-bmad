ALTER TABLE "dummy_testing" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "dummy_testing" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "dummy_testing" ADD COLUMN "age" integer;