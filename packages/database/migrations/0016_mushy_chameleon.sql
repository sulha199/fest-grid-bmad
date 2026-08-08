ALTER TABLE "posts" ALTER COLUMN "post_url" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_post_url_unique" UNIQUE("post_url");