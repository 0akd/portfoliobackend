import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// This defines the shape of our table in the database
export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  text: text('text').notNull(),
  completed: integer('completed', { mode: 'boolean' }).default(false),
});