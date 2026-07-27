Invoke the `bmad-review-edge-case-hunter` skill on this diff:

```diff
diff --git a/SETUP_WALKTHROUGH.md b/SETUP_WALKTHROUGH.md
index a4be72e..0bbd891 100644
--- a/SETUP_WALKTHROUGH.md
+++ b/SETUP_WALKTHROUGH.md
@@ -90,23 +90,30 @@ The backend is built with TypeScript on a serverless architecture using AWS.
 
     *   Deploy the service to AWS: `serverless deploy`
 
-## 3. Database (Supabase)
+## 3. Database (Drizzle ORM, Local Postgres & Supabase)
 
-The database is a managed PostgreSQL instance from Supabase.
+The database schemas are managed code-first using Drizzle ORM in the `packages/database` workspace. The project utilizes a dual environment setup:
 
-### Setup Steps
+### Local Development (PostgreSQL)
 
-1.  **Create a new Supabase project:**
+1.  **Start a Local Postgres Instance:**
+    Ensure you have a PostgreSQL database running locally (e.g., via Docker or native installation).
+2.  **Configure Environment:**
+    Set your `DATABASE_URL` in `packages/database/.env` (e.g., `postgresql://postgres:postgres@localhost:5432/festgrid`).
+3.  **Generate and Run Migrations:**
+    Run `pnpm --filter @festgrid/database generate` to generate migration files.
+    Run `pnpm --filter @festgrid/database migrate` to apply migrations to your local database.
 
-    *   Go to [supabase.com](https://supabase.com/) and create a new project.
+### Production (Supabase Cloud)
 
+1.  **Create a new Supabase project:**
+    Go to [supabase.com](https://supabase.com/) and create a new project.
 2.  **Get Database Credentials:**
-
-    *   In your Supabase project dashboard, go to `Settings` -> `Database` and find your connection string.
-
-3.  **Connect from Backend:**
-
-    *   Use a PostgreSQL client library for Node.js (e.g., `pg`) in your AWS Lambda functions to connect to the Supabase database using the credentials from the previous step.
+    In your Supabase project dashboard, go to `Settings` -> `Database` and find your production connection string.
+3.  **Configure CI/CD:**
+    Add the Supabase connection string to your CI/CD environment variables as `DATABASE_URL`.
+4.  **Deployment:**
+    The CI/CD pipeline runs `drizzle-kit` to automatically apply the generated SQL migration files directly to the Supabase Postgres instance upon deployment.
 
 ## 4. Push Notifications (Firebase Cloud Messaging)
 
diff --git a/packages/database/migrate.ts b/packages/database/migrate.ts
index 22f6e87..c0f70c6 100644
--- a/packages/database/migrate.ts
+++ b/packages/database/migrate.ts
@@ -15,9 +15,10 @@ const runMigrate = async () => {
   const connectionString = process.env.DATABASE_URL;
 
   // for migrations
+  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
   const migrationClient = postgres(connectionString, { 
     max: 1,
-    ssl: 'require' 
+    ssl: isLocal ? false : 'require' 
   });
   const db = drizzle(migrationClient);
 
diff --git a/packages/database/migrations/0001_cuddly_shatterstar.sql b/packages/database/migrations/0001_cuddly_shatterstar.sql
new file mode 100644
index 0000000..4c72247
--- /dev/null
+++ b/packages/database/migrations/0001_cuddly_shatterstar.sql
@@ -0,0 +1,124 @@
+DO $$ BEGIN
+ CREATE TYPE "public"."event_category" AS ENUM('MUSIC', 'ARTS_AND_CULTURE', 'FOOD_AND_DRINK', 'SPORTS_AND_FITNESS', 'FAMILY_AND_KIDS', 'HOBBIES_AND_INTERESTS', 'BUSINESS_AND_NETWORKING', 'HEALTH_AND_WELLNESS', 'HOLIDAY', 'CHARITY_AND_CAUSES', 'CIVIC_AND_COMMUNITY', 'OTHER');
+EXCEPTION
+ WHEN duplicate_object THEN null;
+END $$;
+--> statement-breakpoint
+DO $$ BEGIN
+ CREATE TYPE "public"."event_type" AS ENUM('EXHIBITION', 'COMPETITION', 'FESTIVAL', 'PERFORMANCE', 'WORKSHOP', 'SEMINAR', 'MARKET', 'GATHERING', 'PROMOTION', 'FUNDRAISER', 'CIVIC', 'OTHER');
+EXCEPTION
+ WHEN duplicate_object THEN null;
+END $$;
+--> statement-breakpoint
+CREATE TABLE IF NOT EXISTS "api_keys" (
+	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
+	"user_id" uuid NOT NULL,
+	"key_encrypted" text NOT NULL,
+	"provider" text NOT NULL,
+	"is_valid" boolean DEFAULT true NOT NULL,
+	"invalid_attempts" integer DEFAULT 0 NOT NULL,
+	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
+	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
+);
+--> statement-breakpoint
+CREATE TABLE IF NOT EXISTS "events" (
+	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
+	"slug" text NOT NULL,
+	"event_name" text NOT NULL,
+	"types" text[],
+	"categories" text[],
+	"location" text NOT NULL,
+	"event_owner" text,
+	"contact_info" text,
+	"description" text,
+	"confidence_score" double precision,
+	"source_social_media_account_id" text,
+	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
+	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
+	CONSTRAINT "events_slug_unique" UNIQUE("slug")
+);
+--> statement-breakpoint
+CREATE TABLE IF NOT EXISTS "schedules" (
+	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
+	"slug" text NOT NULL,
+	"event_id" uuid NOT NULL,
+	"is_main_schedule" boolean DEFAULT true NOT NULL,
+	"event_start_date" date NOT NULL,
+	"event_end_date" date,
+	"event_start_time" time,
+	"event_end_time" time,
+	"title" text,
+	"performers" text[],
+	"location" text,
+	"ticket_price" text,
+	"location_details" jsonb,
+	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
+	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
+	CONSTRAINT "schedules_slug_unique" UNIQUE("slug")
+);
+--> statement-breakpoint
+CREATE TABLE IF NOT EXISTS "subscriptions" (
+	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
+	"user_id" uuid NOT NULL,
+	"account_id" text NOT NULL,
+	"platform" text NOT NULL,
+	"display_name" text NOT NULL,
+	"username" text NOT NULL,
+	"profile_image_url" text,
+	"description" text,
+	"last_post_date" timestamp with time zone,
+	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
+	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
+);
+--> statement-breakpoint
+CREATE TABLE IF NOT EXISTS "user_locations" (
+	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
+	"user_id" uuid NOT NULL,
+	"name" text NOT NULL,
+	"latitude" double precision NOT NULL,
+	"longitude" double precision NOT NULL,
+	"radius" integer NOT NULL,
+	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
+	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
+);
+--> statement-breakpoint
+CREATE TABLE IF NOT EXISTS "users" (
+	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
+	"email" text NOT NULL,
+	"name" text,
+	"avatar_url" text,
+	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
+	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
+	CONSTRAINT "users_email_unique" UNIQUE("email")
+);
+--> statement-breakpoint
+DO $$ BEGIN
+ ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
+EXCEPTION
+ WHEN duplicate_object THEN null;
+END $$;
+--> statement-breakpoint
+DO $$ BEGIN
+ ALTER TABLE "schedules" ADD CONSTRAINT "schedules_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
+EXCEPTION
+ WHEN duplicate_object THEN null;
+END $$;
+--> statement-breakpoint
+DO $$ BEGIN
+ ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
+EXCEPTION
+ WHEN duplicate_object THEN null;
+END $$;
+--> statement-breakpoint
+DO $$ BEGIN
+ ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
+EXCEPTION
+ WHEN duplicate_object THEN null;
+END $$;
+--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "event_name_idx" ON "events" ("event_name");--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "event_types_idx" ON "events" ("types");--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "event_categories_idx" ON "events" ("categories");--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "event_location_idx" ON "events" ("location");--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "schedule_performers_idx" ON "schedules" ("performers");--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "schedule_location_idx" ON "schedules" ("location");
\ No newline at end of file
diff --git a/packages/database/migrations/0002_dusty_moon_knight.sql b/packages/database/migrations/0002_dusty_moon_knight.sql
new file mode 100644
index 0000000..234c373
--- /dev/null
+++ b/packages/database/migrations/0002_dusty_moon_knight.sql
@@ -0,0 +1 @@
+DROP TABLE "health_check";
\ No newline at end of file
diff --git a/packages/database/schema.ts b/packages/database/schema.ts
index 3c8e4f4..5da5c96 100644
--- a/packages/database/schema.ts
+++ b/packages/database/schema.ts
@@ -1,4 +1,5 @@
-import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
+import { pgTable, uuid, text, timestamp, boolean, date, time, jsonb, doublePrecision, integer, pgEnum, index } from 'drizzle-orm/pg-core';
+import { relations } from 'drizzle-orm';
 
 // Reusable timestamp columns for future tables to ensure correct timezone handling
 export const timestamps = {
@@ -6,10 +7,132 @@ export const timestamps = {
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
 };
 
-// Dummy table to verify Drizzle ORM setup and migrations.
-// To be removed once actual domain tables are created.
-export const healthCheck = pgTable('health_check', {
+export const eventTypeEnum = pgEnum('event_type', [
+  'EXHIBITION', 'COMPETITION', 'FESTIVAL', 'PERFORMANCE', 'WORKSHOP', 
+  'SEMINAR', 'MARKET', 'GATHERING', 'PROMOTION', 'FUNDRAISER', 'CIVIC', 'OTHER'
+]);
+
+export const eventCategoryEnum = pgEnum('event_category', [
+  'MUSIC', 'ARTS_AND_CULTURE', 'FOOD_AND_DRINK', 'SPORTS_AND_FITNESS', 
+  'FAMILY_AND_KIDS', 'HOBBIES_AND_INTERESTS', 'BUSINESS_AND_NETWORKING', 
+  'HEALTH_AND_WELLNESS', 'HOLIDAY', 'CHARITY_AND_CAUSES', 'CIVIC_AND_COMMUNITY', 'OTHER'
+]);
+
+export const users = pgTable('users', {
+  id: uuid('id').defaultRandom().primaryKey(),
+  email: text('email').unique().notNull(),
+  name: text('name'),
+  avatarUrl: text('avatar_url'),
+  ...timestamps,
+});
+
+export const userLocations = pgTable('user_locations', {
+  id: uuid('id').defaultRandom().primaryKey(),
+  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
+  name: text('name').notNull(),
+  latitude: doublePrecision('latitude').notNull(),
+  longitude: doublePrecision('longitude').notNull(),
+  radius: integer('radius').notNull(),
+  ...timestamps,
+});
+
+export const subscriptions = pgTable('subscriptions', {
+  id: uuid('id').defaultRandom().primaryKey(),
+  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
+  accountId: text('account_id').notNull(),
+  platform: text('platform').notNull(),
+  displayName: text('display_name').notNull(),
+  username: text('username').notNull(),
+  profileImageUrl: text('profile_image_url'),
+  description: text('description'),
+  lastPostDate: timestamp('last_post_date', { withTimezone: true }),
+  ...timestamps,
+});
+
+export const apiKeys = pgTable('api_keys', {
   id: uuid('id').defaultRandom().primaryKey(),
-  status: text('status').notNull(),
+  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
+  keyEncrypted: text('key_encrypted').notNull(),
+  provider: text('provider').notNull(),
+  isValid: boolean('is_valid').default(true).notNull(),
+  invalidAttempts: integer('invalid_attempts').default(0).notNull(),
   ...timestamps,
 });
+
+export const events = pgTable('events', {
+  id: uuid('id').defaultRandom().primaryKey(),
+  slug: text('slug').unique().notNull(),
+  eventName: text('event_name').notNull(),
+  types: text('types').array(),
+  categories: text('categories').array(),
+  location: text('location').notNull(),
+  eventOwner: text('event_owner'),
+  contactInfo: text('contact_info'),
+  description: text('description'),
+  confidenceScore: doublePrecision('confidence_score'),
+  sourceSocialMediaAccountId: text('source_social_media_account_id'),
+  ...timestamps,
+}, (t) => ({
+  nameIdx: index('event_name_idx').on(t.eventName),
+  typesIdx: index('event_types_idx').on(t.types),
+  categoriesIdx: index('event_categories_idx').on(t.categories),
+  locationIdx: index('event_location_idx').on(t.location),
+}));
+
+export const schedules = pgTable('schedules', {
+  id: uuid('id').defaultRandom().primaryKey(),
+  slug: text('slug').unique().notNull(),
+  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
+  isMainSchedule: boolean('is_main_schedule').default(true).notNull(),
+  eventStartDate: date('event_start_date').notNull(),
+  eventEndDate: date('event_end_date'),
+  eventStartTime: time('event_start_time'),
+  eventEndTime: time('event_end_time'),
+  title: text('title'),
+  performers: text('performers').array(),
+  location: text('location'),
+  ticketPrice: text('ticket_price'),
+  locationDetails: jsonb('location_details'),
+  ...timestamps,
+}, (t) => ({
+  performersIdx: index('schedule_performers_idx').on(t.performers),
+  locationIdx: index('schedule_location_idx').on(t.location),
+}));
+
+export const eventsRelations = relations(events, ({ many }) => ({
+  schedules: many(schedules),
+}));
+
+export const schedulesRelations = relations(schedules, ({ one }) => ({
+  event: one(events, {
+    fields: [schedules.eventId],
+    references: [events.id],
+  }),
+}));
+
+export const usersRelations = relations(users, ({ many }) => ({
+  userLocations: many(userLocations),
+  subscriptions: many(subscriptions),
+  apiKeys: many(apiKeys),
+}));
+
+export const userLocationsRelations = relations(userLocations, ({ one }) => ({
+  user: one(users, {
+    fields: [userLocations.userId],
+    references: [users.id],
+  }),
+}));
+
+export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
+  user: one(users, {
+    fields: [subscriptions.userId],
+    references: [users.id],
+  }),
+}));
+
+export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
+  user: one(users, {
+    fields: [apiKeys.userId],
+    references: [users.id],
+  }),
+}));

```