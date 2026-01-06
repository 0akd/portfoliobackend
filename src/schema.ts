import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  text: text('text').notNull(),
  priority: integer('priority').default(0), 
  completed: integer('completed', { mode: 'boolean' }).default(false),
category: text('category').default(''),
    unit: text('unit').default('units'), 
  requiredItems: text('required_items', { mode: 'json' }).$type<string[]>().default([]),
  procedure: text('procedure', { mode: 'json' }).$type<string[]>().default([]),

  // NEW: Live Metrics
  activeCounter: integer('active_counter').default(0),
  activeTimer: integer('active_timer').default(0), // stored in seconds
});

export const todoHistory = sqliteTable('todo_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  todoId: integer('todo_id').references(() => todos.id, { onDelete: 'cascade' }).notNull(),
  timestamp: text('timestamp').notNull(), 
  sessionId: text('session_id').notNull(), 
  completed: integer('completed', { mode: 'boolean' }).default(false),
  
  // NEW: Historical Snapshots
  snapshotCounter: integer('snapshot_counter').default(0),
  snapshotTimer: integer('snapshot_timer').default(0),
});

export const todosRelations = relations(todos, ({ many }) => ({
  history: many(todoHistory),
}));