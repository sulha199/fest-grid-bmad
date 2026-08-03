Invoke the `bmad-review-edge-case-hunter` skill on this diff:

diff --git a/packages/database/migrations/0001_watery_the_fury.sql b/packages/database/migrations/0001_watery_the_fury.sql
new file mode 100644
index 0000000..ca9c99f
--- /dev/null
+++ b/packages/database/migrations/0001_watery_the_fury.sql
@@ -0,0 +1,28 @@
+CREATE TABLE IF NOT EXISTS "posts" (
+	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
+	"subscription_id" uuid,
+	"content" text NOT NULL,
+	"image_url" text,
+	"post_url" text,
+	"is_extracted" boolean DEFAULT false NOT NULL,
+	"published_at" timestamp with time zone NOT NULL,
+	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
+	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
+);
+--> statement-breakpoint
+ALTER TABLE "events" ADD COLUMN "post_id" uuid;--> statement-breakpoint
+DO $$ BEGIN
+ ALTER TABLE "posts" ADD CONSTRAINT "posts_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;
+EXCEPTION
+ WHEN duplicate_object THEN null;
+END $$;
+--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "subscription_id_idx" ON "posts" ("subscription_id");--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "published_at_idx" ON "posts" ("published_at");--> statement-breakpoint
+DO $$ BEGIN
+ ALTER TABLE "events" ADD CONSTRAINT "events_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
+EXCEPTION
+ WHEN duplicate_object THEN null;
+END $$;
+--> statement-breakpoint
+CREATE INDEX IF NOT EXISTS "event_post_id_idx" ON "events" ("post_id");
\ No newline at end of file
diff --git a/packages/database/migrations/meta/0001_snapshot.json b/packages/database/migrations/meta/0001_snapshot.json
new file mode 100644
index 0000000..21c419d
--- /dev/null
+++ b/packages/database/migrations/meta/0001_snapshot.json
@@ -0,0 +1,759 @@
+{
+  "id": "667fa139-5f2f-4e42-b012-b1287232c441",
+  "prevId": "2b923af7-a452-478d-9a3a-fc06f9164fae",
+  "version": "6",
+  "dialect": "postgresql",
+  "tables": {
+    "public.api_keys": {
+      "name": "api_keys",
+      "schema": "",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "uuid",
+          "primaryKey": true,
+          "notNull": true,
+          "default": "gen_random_uuid()"
+        },
+        "user_id": {
+          "name": "user_id",
+          "type": "uuid",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "key_encrypted": {
+          "name": "key_encrypted",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "provider": {
+          "name": "provider",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "is_valid": {
+          "name": "is_valid",
+          "type": "boolean",
+          "primaryKey": false,
+          "notNull": true,
+          "default": true
+        },
+        "invalid_attempts": {
+          "name": "invalid_attempts",
+          "type": "integer",
+          "primaryKey": false,
+          "notNull": true,
+          "default": 0
+        },
+        "deleted_at": {
+          "name": "deleted_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        }
+      },
+      "indexes": {},
+      "foreignKeys": {
+        "api_keys_user_id_users_id_fk": {
+          "name": "api_keys_user_id_users_id_fk",
+          "tableFrom": "api_keys",
+          "tableTo": "users",
+          "columnsFrom": [
+            "user_id"
+          ],
+          "columnsTo": [
+            "id"
+          ],
+          "onDelete": "no action",
+          "onUpdate": "no action"
+        }
+      },
+      "compositePrimaryKeys": {},
+      "uniqueConstraints": {}
+    },
+    "public.events": {
+      "name": "events",
+      "schema": "",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "uuid",
+          "primaryKey": true,
+          "notNull": true,
+          "default": "gen_random_uuid()"
+        },
+        "slug": {
+          "name": "slug",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "event_name": {
+          "name": "event_name",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "types": {
+          "name": "types",
+          "type": "text[]",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "categories": {
+          "name": "categories",
+          "type": "text[]",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "location": {
+          "name": "location",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "organizer_name": {
+          "name": "organizer_name",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "contact_info": {
+          "name": "contact_info",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "description": {
+          "name": "description",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "confidence_score": {
+          "name": "confidence_score",
+          "type": "double precision",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "source_social_media_account_id": {
+          "name": "source_social_media_account_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "post_id": {
+          "name": "post_id",
+          "type": "uuid",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        }
+      },
+      "indexes": {
+        "event_name_idx": {
+          "name": "event_name_idx",
+          "columns": [
+            "event_name"
+          ],
+          "isUnique": false
+        },
+        "event_types_idx": {
+          "name": "event_types_idx",
+          "columns": [
+            "types"
+          ],
+          "isUnique": false
+        },
+        "event_categories_idx": {
+          "name": "event_categories_idx",
+          "columns": [
+            "categories"
+          ],
+          "isUnique": false
+        },
+        "event_location_idx": {
+          "name": "event_location_idx",
+          "columns": [
+            "location"
+          ],
+          "isUnique": false
+        },
+        "event_post_id_idx": {
+          "name": "event_post_id_idx",
+          "columns": [
+            "post_id"
+          ],
+          "isUnique": false
+        }
+      },
+      "foreignKeys": {
+        "events_post_id_posts_id_fk": {
+          "name": "events_post_id_posts_id_fk",
+          "tableFrom": "events",
+          "tableTo": "posts",
+          "columnsFrom": [
+            "post_id"
+          ],
+          "columnsTo": [
+            "id"
+          ],
+          "onDelete": "set null",
+          "onUpdate": "no action"
+        }
+      },
+      "compositePrimaryKeys": {},
+      "uniqueConstraints": {
+        "events_slug_unique": {
+          "name": "events_slug_unique",
+          "nullsNotDistinct": false,
+          "columns": [
+            "slug"
+          ]
+        }
+      }
+    },
+    "public.posts": {
+      "name": "posts",
+      "schema": "",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "uuid",
+          "primaryKey": true,
+          "notNull": true,
+          "default": "gen_random_uuid()"
+        },
+        "subscription_id": {
+          "name": "subscription_id",
+          "type": "uuid",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "content": {
+          "name": "content",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "image_url": {
+          "name": "image_url",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "post_url": {
+          "name": "post_url",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "is_extracted": {
+          "name": "is_extracted",
+          "type": "boolean",
+          "primaryKey": false,
+          "notNull": true,
+          "default": false
+        },
+        "published_at": {
+          "name": "published_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        }
+      },
+      "indexes": {
+        "subscription_id_idx": {
+          "name": "subscription_id_idx",
+          "columns": [
+            "subscription_id"
+          ],
+          "isUnique": false
+        },
+        "published_at_idx": {
+          "name": "published_at_idx",
+          "columns": [
+            "published_at"
+          ],
+          "isUnique": false
+        }
+      },
+      "foreignKeys": {
+        "posts_subscription_id_subscriptions_id_fk": {
+          "name": "posts_subscription_id_subscriptions_id_fk",
+          "tableFrom": "posts",
+          "tableTo": "subscriptions",
+          "columnsFrom": [
+            "subscription_id"
+          ],
+          "columnsTo": [
+            "id"
+          ],
+          "onDelete": "no action",
+          "onUpdate": "no action"
+        }
+      },
+      "compositePrimaryKeys": {},
+      "uniqueConstraints": {}
+    },
+    "public.schedules": {
+      "name": "schedules",
+      "schema": "",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "uuid",
+          "primaryKey": true,
+          "notNull": true,
+          "default": "gen_random_uuid()"
+        },
+        "slug": {
+          "name": "slug",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "event_id": {
+          "name": "event_id",
+          "type": "uuid",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "is_main_schedule": {
+          "name": "is_main_schedule",
+          "type": "boolean",
+          "primaryKey": false,
+          "notNull": true,
+          "default": true
+        },
+        "event_start_date": {
+          "name": "event_start_date",
+          "type": "date",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "event_end_date": {
+          "name": "event_end_date",
+          "type": "date",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "event_start_time": {
+          "name": "event_start_time",
+          "type": "time",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "event_end_time": {
+          "name": "event_end_time",
+          "type": "time",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "title": {
+          "name": "title",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "performers": {
+          "name": "performers",
+          "type": "text[]",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "location": {
+          "name": "location",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "ticket_price": {
+          "name": "ticket_price",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "location_details": {
+          "name": "location_details",
+          "type": "jsonb",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        }
+      },
+      "indexes": {
+        "schedule_performers_idx": {
+          "name": "schedule_performers_idx",
+          "columns": [
+            "performers"
+          ],
+          "isUnique": false
+        },
+        "schedule_location_idx": {
+          "name": "schedule_location_idx",
+          "columns": [
+            "location"
+          ],
+          "isUnique": false
+        }
+      },
+      "foreignKeys": {
+        "schedules_event_id_events_id_fk": {
+          "name": "schedules_event_id_events_id_fk",
+          "tableFrom": "schedules",
+          "tableTo": "events",
+          "columnsFrom": [
+            "event_id"
+          ],
+          "columnsTo": [
+            "id"
+          ],
+          "onDelete": "cascade",
+          "onUpdate": "no action"
+        }
+      },
+      "compositePrimaryKeys": {},
+      "uniqueConstraints": {
+        "schedules_slug_unique": {
+          "name": "schedules_slug_unique",
+          "nullsNotDistinct": false,
+          "columns": [
+            "slug"
+          ]
+        }
+      }
+    },
+    "public.subscriptions": {
+      "name": "subscriptions",
+      "schema": "",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "uuid",
+          "primaryKey": true,
+          "notNull": true,
+          "default": "gen_random_uuid()"
+        },
+        "user_id": {
+          "name": "user_id",
+          "type": "uuid",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "account_id": {
+          "name": "account_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "platform": {
+          "name": "platform",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "display_name": {
+          "name": "display_name",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "username": {
+          "name": "username",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "profile_image_url": {
+          "name": "profile_image_url",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "description": {
+          "name": "description",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "last_post_date": {
+          "name": "last_post_date",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        }
+      },
+      "indexes": {},
+      "foreignKeys": {
+        "subscriptions_user_id_users_id_fk": {
+          "name": "subscriptions_user_id_users_id_fk",
+          "tableFrom": "subscriptions",
+          "tableTo": "users",
+          "columnsFrom": [
+            "user_id"
+          ],
+          "columnsTo": [
+            "id"
+          ],
+          "onDelete": "cascade",
+          "onUpdate": "no action"
+        }
+      },
+      "compositePrimaryKeys": {},
+      "uniqueConstraints": {}
+    },
+    "public.user_locations": {
+      "name": "user_locations",
+      "schema": "",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "uuid",
+          "primaryKey": true,
+          "notNull": true,
+          "default": "gen_random_uuid()"
+        },
+        "user_id": {
+          "name": "user_id",
+          "type": "uuid",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "name": {
+          "name": "name",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "latitude": {
+          "name": "latitude",
+          "type": "double precision",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "longitude": {
+          "name": "longitude",
+          "type": "double precision",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "radius": {
+          "name": "radius",
+          "type": "integer",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        }
+      },
+      "indexes": {},
+      "foreignKeys": {
+        "user_locations_user_id_users_id_fk": {
+          "name": "user_locations_user_id_users_id_fk",
+          "tableFrom": "user_locations",
+          "tableTo": "users",
+          "columnsFrom": [
+            "user_id"
+          ],
+          "columnsTo": [
+            "id"
+          ],
+          "onDelete": "cascade",
+          "onUpdate": "no action"
+        }
+      },
+      "compositePrimaryKeys": {},
+      "uniqueConstraints": {}
+    },
+    "public.users": {
+      "name": "users",
+      "schema": "",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "uuid",
+          "primaryKey": true,
+          "notNull": true,
+          "default": "gen_random_uuid()"
+        },
+        "email": {
+          "name": "email",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "name": {
+          "name": "name",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "avatar_url": {
+          "name": "avatar_url",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "deleted_at": {
+          "name": "deleted_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        }
+      },
+      "indexes": {},
+      "foreignKeys": {},
+      "compositePrimaryKeys": {},
+      "uniqueConstraints": {
+        "users_email_unique": {
+          "name": "users_email_unique",
+          "nullsNotDistinct": false,
+          "columns": [
+            "email"
+          ]
+        }
+      }
+    }
+  },
+  "enums": {
+    "public.event_category": {
+      "name": "event_category",
+      "schema": "public",
+      "values": [
+        "MUSIC",
+        "ARTS_AND_CULTURE",
+        "FOOD_AND_DRINK",
+        "SPORTS_AND_FITNESS",
+        "FAMILY_AND_KIDS",
+        "HOBBIES_AND_INTERESTS",
+        "BUSINESS_AND_NETWORKING",
+        "HEALTH_AND_WELLNESS",
+        "HOLIDAY",
+        "CHARITY_AND_CAUSES",
+        "CIVIC_AND_COMMUNITY",
+        "OTHER"
+      ]
+    },
+    "public.event_type": {
+      "name": "event_type",
+      "schema": "public",
+      "values": [
+        "EXHIBITION",
+        "COMPETITION",
+        "FESTIVAL",
+        "PERFORMANCE",
+        "WORKSHOP",
+        "SEMINAR",
+        "MARKET",
+        "GATHERING",
+        "PROMOTION",
+        "FUNDRAISER",
+        "CIVIC",
+        "OTHER"
+      ]
+    }
+  },
+  "schemas": {},
+  "_meta": {
+    "columns": {},
+    "schemas": {},
+    "tables": {}
+  }
+}
\ No newline at end of file
diff --git a/packages/database/migrations/meta/_journal.json b/packages/database/migrations/meta/_journal.json
index e64b7fa..69563c7 100644
--- a/packages/database/migrations/meta/_journal.json
+++ b/packages/database/migrations/meta/_journal.json
@@ -8,6 +8,13 @@
       "when": 1785161765718,
       "tag": "0000_cultured_ultragirl",
       "breakpoints": true
+    },
+    {
+      "idx": 1,
+      "version": "6",
+      "when": 1785549662945,
+      "tag": "0001_watery_the_fury",
+      "breakpoints": true
     }
   ]
 }
\ No newline at end of file
diff --git a/packages/database/schema.ts b/packages/database/schema.ts
index bea1bc0..52468c6 100644
--- a/packages/database/schema.ts
+++ b/packages/database/schema.ts
@@ -63,6 +63,20 @@ export const apiKeys = pgTable('api_keys', {
   ...timestamps,
 });
 
+export const posts = pgTable('posts', {
+  id: uuid('id').defaultRandom().primaryKey(),
+  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
+  content: text('content').notNull(),
+  imageUrl: text('image_url'),
+  postUrl: text('post_url'),
+  isExtracted: boolean('is_extracted').default(false).notNull(),
+  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
+  ...timestamps,
+}, (t) => ({
+  subscriptionIdIdx: index('subscription_id_idx').on(t.subscriptionId),
+  publishedAtIdx: index('published_at_idx').on(t.publishedAt),
+}));
+
 export const events = pgTable('events', {
   id: uuid('id').defaultRandom().primaryKey(),
   slug: text('slug').unique().notNull(),
@@ -79,12 +93,14 @@ export const events = pgTable('events', {
   description: text('description'),
   confidenceScore: doublePrecision('confidence_score'),
   sourceSocialMediaAccountId: text('source_social_media_account_id'),
+  postId: uuid('post_id').references(() => posts.id, { onDelete: 'set null' }),
   ...timestamps,
 }, (t) => ({
   nameIdx: index('event_name_idx').on(t.eventName),
   typesIdx: index('event_types_idx').on(t.types),
   categoriesIdx: index('event_categories_idx').on(t.categories),
   locationIdx: index('event_location_idx').on(t.location),
+  postIdIdx: index('event_post_id_idx').on(t.postId),
 }));
 
 export const schedules = pgTable('schedules', {
@@ -109,8 +125,20 @@ export const schedules = pgTable('schedules', {
   locationIdx: index('schedule_location_idx').on(t.location),
 }));
 
-export const eventsRelations = relations(events, ({ many }) => ({
+export const eventsRelations = relations(events, ({ one, many }) => ({
   schedules: many(schedules),
+  post: one(posts, {
+    fields: [events.postId],
+    references: [posts.id],
+  }),
+}));
+
+export const postsRelations = relations(posts, ({ one, many }) => ({
+  subscription: one(subscriptions, {
+    fields: [posts.subscriptionId],
+    references: [subscriptions.id],
+  }),
+  events: many(events),
 }));
 
 export const schedulesRelations = relations(schedules, ({ one }) => ({
@@ -133,11 +161,12 @@ export const userLocationsRelations = relations(userLocations, ({ one }) => ({
   }),
 }));
 
-export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
+export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
   user: one(users, {
     fields: [subscriptions.userId],
     references: [users.id],
   }),
+  posts: many(posts),
 }));
 
 export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
diff --git a/packages/database/seed.integration.test.ts b/packages/database/seed.integration.test.ts
index 8fa22cd..46b0690 100644
--- a/packages/database/seed.integration.test.ts
+++ b/packages/database/seed.integration.test.ts
@@ -5,6 +5,7 @@ import { eq, isNull, sql } from 'drizzle-orm';
 import {
   apiKeys,
   events,
+  posts,
   schedules,
   subscriptions,
   userLocations,
@@ -15,6 +16,7 @@ import {
   FIXTURE_COUNTS,
   FIXTURE_EVENT_IDS,
   FIXTURE_EVENT_SLUGS,
+  FIXTURE_POST_IDS,
   FIXTURE_SCHEDULE_IDS,
   FIXTURE_SCHEDULE_SLUGS,
   FIXTURE_SUBSCRIPTION_IDS,
@@ -51,6 +53,7 @@ test('seed is deterministic, relationally valid, and idempotent', async () => {
       const [userLocationCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(userLocations);
       const [subscriptionCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(subscriptions);
       const [apiKeyCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(apiKeys);
+      const [postCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(posts);
       const [eventCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(events);
       const [scheduleCount] = await db.select({ count: sql<number>`cast(count(*) as int)` }).from(schedules);
 
@@ -58,9 +61,20 @@ test('seed is deterministic, relationally valid, and idempotent', async () => {
       assert.equal(userLocationCount.count, FIXTURE_COUNTS.userLocations);
       assert.equal(subscriptionCount.count, FIXTURE_COUNTS.subscriptions);
       assert.equal(apiKeyCount.count, FIXTURE_COUNTS.apiKeys);
+      assert.equal(postCount.count, FIXTURE_COUNTS.posts);
       assert.equal(eventCount.count, FIXTURE_COUNTS.events);
       assert.equal(scheduleCount.count, FIXTURE_COUNTS.schedules);
 
+      const eventPostJoins = await db
+        .select({ eventId: events.id, imageUrl: posts.imageUrl })
+        .from(events)
+        .leftJoin(posts, eq(events.postId, posts.id));
+      
+      assert.equal(eventPostJoins.length, FIXTURE_COUNTS.events);
+      eventPostJoins.forEach((row) => {
+        assert.ok(row.imageUrl !== null && row.imageUrl !== undefined, `Event ${row.eventId} is missing linked post imageUrl`);
+      });
+
       const orphanSchedules = await db
         .select({ scheduleId: schedules.id })
         .from(schedules)
@@ -96,6 +110,7 @@ test('seed is deterministic, relationally valid, and idempotent', async () => {
       const userLocationIdRows = await db.select({ id: userLocations.id }).from(userLocations);
       const subscriptionIdRows = await db.select({ id: subscriptions.id }).from(subscriptions);
       const apiKeyIdRows = await db.select({ id: apiKeys.id }).from(apiKeys);
+      const postIdRows = await db.select({ id: posts.id }).from(posts);
       const eventIdRows = await db.select({ id: events.id }).from(events);
       const scheduleIdRows = await db.select({ id: schedules.id }).from(schedules);
 
@@ -115,6 +130,10 @@ test('seed is deterministic, relationally valid, and idempotent', async () => {
         apiKeyIdRows.map((row) => row.id).sort(),
         FIXTURE_API_KEY_IDS,
       );
+      assert.deepEqual(
+        postIdRows.map((row) => row.id).sort(),
+        FIXTURE_POST_IDS,
+      );
       assert.deepEqual(
         eventIdRows.map((row) => row.id).sort(),
         FIXTURE_EVENT_IDS,
@@ -182,6 +201,9 @@ test('seed is deterministic, relationally valid, and idempotent', async () => {
       const [apiKeyCountSecondRun] = await dbAfterSecondRun
         .select({ count: sql<number>`cast(count(*) as int)` })
         .from(apiKeys);
+      const [postCountSecondRun] = await dbAfterSecondRun
+        .select({ count: sql<number>`cast(count(*) as int)` })
+        .from(posts);
       const [eventCountSecondRun] = await dbAfterSecondRun
         .select({ count: sql<number>`cast(count(*) as int)` })
         .from(events);
@@ -193,9 +215,20 @@ test('seed is deterministic, relationally valid, and idempotent', async () => {
       assert.equal(userLocationCountSecondRun.count, FIXTURE_COUNTS.userLocations);
       assert.equal(subscriptionCountSecondRun.count, FIXTURE_COUNTS.subscriptions);
       assert.equal(apiKeyCountSecondRun.count, FIXTURE_COUNTS.apiKeys);
+      assert.equal(postCountSecondRun.count, FIXTURE_COUNTS.posts);
       assert.equal(eventCountSecondRun.count, FIXTURE_COUNTS.events);
       assert.equal(scheduleCountSecondRun.count, FIXTURE_COUNTS.schedules);
 
+      const eventPostJoinsSecondRun = await dbAfterSecondRun
+        .select({ eventId: events.id, imageUrl: posts.imageUrl })
+        .from(events)
+        .leftJoin(posts, eq(events.postId, posts.id));
+      
+      assert.equal(eventPostJoinsSecondRun.length, FIXTURE_COUNTS.events);
+      eventPostJoinsSecondRun.forEach((row) => {
+        assert.ok(row.imageUrl !== null && row.imageUrl !== undefined, `Event ${row.eventId} is missing linked post imageUrl`);
+      });
+
       const userIdRowsSecondRun = await dbAfterSecondRun.select({ id: users.id }).from(users);
       const userLocationIdRowsSecondRun = await dbAfterSecondRun
         .select({ id: userLocations.id })
@@ -206,6 +239,9 @@ test('seed is deterministic, relationally valid, and idempotent', async () => {
       const apiKeyIdRowsSecondRun = await dbAfterSecondRun
         .select({ id: apiKeys.id })
         .from(apiKeys);
+      const postIdRowsSecondRun = await dbAfterSecondRun
+        .select({ id: posts.id })
+        .from(posts);
       const eventIdRowsSecondRun = await dbAfterSecondRun.select({ id: events.id }).from(events);
       const scheduleIdRowsSecondRun = await dbAfterSecondRun
         .select({ id: schedules.id })
@@ -231,6 +267,10 @@ test('seed is deterministic, relationally valid, and idempotent', async () => {
         apiKeyIdRowsSecondRun.map((row) => row.id).sort(),
         FIXTURE_API_KEY_IDS,
       );
+      assert.deepEqual(
+        postIdRowsSecondRun.map((row) => row.id).sort(),
+        FIXTURE_POST_IDS,
+      );
       assert.deepEqual(
         eventIdRowsSecondRun.map((row) => row.id).sort(),
         FIXTURE_EVENT_IDS,
diff --git a/packages/database/seed.ts b/packages/database/seed.ts
index a0e29b4..11696f6 100644
--- a/packages/database/seed.ts
+++ b/packages/database/seed.ts
@@ -3,6 +3,7 @@ import postgres from 'postgres';
 import {
   apiKeys,
   events,
+  posts,
   schedules,
   subscriptions,
   userLocations,
@@ -86,6 +87,36 @@ const FIXTURE_API_KEYS = [
   },
 ];
 
+const FIXTURE_POSTS = [
+  {
+    id: '60000000-0000-0000-0000-000000000001',
+    subscriptionId: FIXTURE_SUBSCRIPTIONS[0].id,
+    postUrl: 'https://instagram.com/jktcity.events/p/C1PASTJAZZ',
+    imageUrl: 'https://images.example.com/events/past-jazz-night.jpg',
+    isExtracted: true,
+    publishedAt: new Date('2025-01-20T10:00:00Z'),
+    content: 'Get ready for an amazing Past Jazz Night 2025! #jazz #jakarta',
+  },
+  {
+    id: '60000000-0000-0000-0000-000000000002',
+    subscriptionId: FIXTURE_SUBSCRIPTIONS[0].id,
+    postUrl: 'https://instagram.com/jktcity.events/p/C2ONGOING',
+    imageUrl: 'https://images.example.com/events/ongoing-culture-fest.jpg',
+    isExtracted: true,
+    publishedAt: new Date('2025-12-10T10:00:00Z'),
+    content: 'The Ongoing Culture Fest 2026-2027 is finally here. #culture #festival',
+  },
+  {
+    id: '60000000-0000-0000-0000-000000000003',
+    subscriptionId: FIXTURE_SUBSCRIPTIONS[1].id,
+    postUrl: 'https://instagram.com/bdg.family.weekend/p/C3UPCOMING',
+    imageUrl: 'https://images.example.com/events/upcoming-family-workshop.jpg',
+    isExtracted: true,
+    publishedAt: new Date('2027-10-15T10:00:00Z'),
+    content: 'Join us at the Upcoming Family Workshop 2027! Fun for all ages. #family #bandung',
+  },
+];
+
 const FIXTURE_EVENTS = [
   {
     id: '40000000-0000-0000-0000-000000000001',
@@ -96,9 +127,9 @@ const FIXTURE_EVENTS = [
     location: 'South Jakarta Art Hall',
     organizerName: 'Nusantara Sound Collective',
     contactInfo: 'https://instagram.com/jktcity.events/p/C1PASTJAZZ',
-    description: 'Poster image: https://images.example.com/events/past-jazz-night.jpg',
     confidenceScore: 0.96,
     sourceSocialMediaAccountId: FIXTURE_SUBSCRIPTIONS[0].accountId,
+    postId: FIXTURE_POSTS[0].id,
   },
   {
     id: '40000000-0000-0000-0000-000000000002',
@@ -109,9 +140,9 @@ const FIXTURE_EVENTS = [
     location: 'Merdeka Square, Jakarta',
     organizerName: 'City Culture Office',
     contactInfo: 'https://instagram.com/jktcity.events/p/C2ONGOING',
-    description: 'Poster image: https://images.example.com/events/ongoing-culture-fest.jpg',
     confidenceScore: 0.91,
     sourceSocialMediaAccountId: FIXTURE_SUBSCRIPTIONS[0].accountId,
+    postId: FIXTURE_POSTS[1].id,
   },
   {
     id: '40000000-0000-0000-0000-000000000003',
@@ -122,9 +153,9 @@ const FIXTURE_EVENTS = [
     location: 'Bandung Community Hub',
     organizerName: 'Bandung Family Weekend',
     contactInfo: 'https://instagram.com/bdg.family.weekend/p/C3UPCOMING',
-    description: 'Poster image: https://images.example.com/events/upcoming-family-workshop.jpg',
     confidenceScore: 0.93,
     sourceSocialMediaAccountId: FIXTURE_SUBSCRIPTIONS[1].accountId,
+    postId: FIXTURE_POSTS[2].id,
   },
 ];
 
@@ -196,6 +227,7 @@ export const FIXTURE_COUNTS = {
   userLocations: FIXTURE_USER_LOCATIONS.length,
   subscriptions: FIXTURE_SUBSCRIPTIONS.length,
   apiKeys: FIXTURE_API_KEYS.length,
+  posts: FIXTURE_POSTS.length,
   events: FIXTURE_EVENTS.length,
   schedules: FIXTURE_SCHEDULES.length,
 } as const;
@@ -204,12 +236,13 @@ export const FIXTURE_USER_IDS = FIXTURE_USERS.map((user) => user.id).sort();
 export const FIXTURE_USER_LOCATION_IDS = FIXTURE_USER_LOCATIONS.map((location) => location.id).sort();
 export const FIXTURE_SUBSCRIPTION_IDS = FIXTURE_SUBSCRIPTIONS.map((subscription) => subscription.id).sort();
 export const FIXTURE_API_KEY_IDS = FIXTURE_API_KEYS.map((apiKey) => apiKey.id).sort();
+export const FIXTURE_POST_IDS = FIXTURE_POSTS.map((post) => post.id).sort();
 export const FIXTURE_EVENT_IDS = FIXTURE_EVENTS.map((event) => event.id).sort();
 export const FIXTURE_SCHEDULE_IDS = FIXTURE_SCHEDULES.map((schedule) => schedule.id).sort();
 export const FIXTURE_EVENT_SLUGS = FIXTURE_EVENTS.map((event) => event.slug).sort();
 export const FIXTURE_SCHEDULE_SLUGS = FIXTURE_SCHEDULES.map((schedule) => schedule.slug).sort();
 
-function isLocalConnectionString(connectionString: string): boolean {
+export function isLocalConnectionString(connectionString: string): boolean {
   try {
     const parsed = new URL(connectionString);
     const hostname = parsed.hostname.toLowerCase();
@@ -249,16 +282,18 @@ export async function seedDatabase(connectionString?: string): Promise<void> {
     await db.transaction(async (tx) => {
       // Explicit deletion order protects FK constraints and ensures deterministic reruns.
       await tx.delete(schedules);
+      await tx.delete(events);
+      await tx.delete(posts);
       await tx.delete(apiKeys);
       await tx.delete(subscriptions);
       await tx.delete(userLocations);
-      await tx.delete(events);
       await tx.delete(users);
 
       await tx.insert(users).values([...FIXTURE_USERS]);
       await tx.insert(userLocations).values([...FIXTURE_USER_LOCATIONS]);
       await tx.insert(subscriptions).values([...FIXTURE_SUBSCRIPTIONS]);
       await tx.insert(apiKeys).values([...FIXTURE_API_KEYS]);
+      await tx.insert(posts).values([...FIXTURE_POSTS]);
       await tx.insert(events).values([...FIXTURE_EVENTS]);
       await tx.insert(schedules).values([...FIXTURE_SCHEDULES]);
     });
diff --git a/packages/shared-types/src/index.ts b/packages/shared-types/src/index.ts
index 0a4ce87..d48e256 100644
--- a/packages/shared-types/src/index.ts
+++ b/packages/shared-types/src/index.ts
@@ -97,6 +97,7 @@ export interface EventInfo {
   sourceSocialMediaAccountId?: string;
   isFavorited?: boolean;
   isAddedToCalendar?: boolean;
+  postId?: string;
 }
 
 export interface SocialMediaAccountProfile {
