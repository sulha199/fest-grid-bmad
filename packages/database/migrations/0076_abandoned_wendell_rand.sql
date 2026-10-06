CREATE TABLE IF NOT EXISTS "vendor_call_locks" (
	"lock_key" text PRIMARY KEY NOT NULL,
	"locked_until" timestamp with time zone NOT NULL
);
