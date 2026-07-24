import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const dummyTesting = pgTable('dummy_testing', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  age: integer('age'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
