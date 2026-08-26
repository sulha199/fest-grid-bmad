ALTER TABLE "posts" ADD COLUMN "durable_image_url" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "image_url_expires_at" timestamp with time zone;