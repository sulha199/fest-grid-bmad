ALTER TYPE "correction_status" ADD VALUE 'awaiting_verification';--> statement-breakpoint
ALTER TABLE "corrections" ADD COLUMN "guardian_permission_confirmed" boolean DEFAULT false NOT NULL;