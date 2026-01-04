// src/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  text: text('text').notNull(),
  priority: integer('priority').default(0), 
  completed: integer('completed', { mode: 'boolean' }).default(false),
  category: text('category', { mode: 'json' }).$type<string[]>().default([]),
  
  // NEW: Structured Data
  requiredItems: text('required_items', { mode: 'json' }).$type<string[]>().default([]),
  procedure: text('procedure', { mode: 'json' }).$type<string[]>().default([]),
});

export const todoHistory = sqliteTable('todo_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  todoId: integer('todo_id').references(() => todos.id, { onDelete: 'cascade' }).notNull(),
  timestamp: text('timestamp').notNull(), 
  sessionId: text('session_id').notNull(), 
  completed: integer('completed', { mode: 'boolean' }).default(false),
});

export const todosRelations = relations(todos, ({ many }) => ({
  history: many(todoHistory),
}));