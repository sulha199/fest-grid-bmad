ALTER TYPE "default_location_change_status" ADD VALUE IF NOT EXISTS 'AWAITING_APPROVAL' BEFORE 'PENDING_REVIEW';--> statement-breakpoint
ALTER TYPE "default_location_change_status" ADD VALUE IF NOT EXISTS 'REJECTED' BEFORE 'REVERTED';--> statement-breakpoint
ALTER TABLE "default_location_change_requests" ADD COLUMN "confidence_score" double precision;
