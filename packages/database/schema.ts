import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

// Reusable timestamp columns for future tables to ensure correct timezone handling
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

// Dummy table to verify Drizzle ORM setup and migrations.
// To be removed once actual domain tables are created.
export const healthCheck = pgTable('health_check', {
  id: uuid('id').defaultRandom().primaryKey(),
  status: text('status').notNull(),
  ...timestamps,
});
