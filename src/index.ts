import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/web'; // Note the '/web' import for Workers
import { todos } from './schema.js'; // Keep the .js extension!
import { eq } from 'drizzle-orm';

// Initialize Hono
const app = new Hono();

// Middleware
app.use('/*', cors());

// Helper to get DB connection (Workers create a fresh connection per request)
const getDb = (env: any) => {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  return drizzle(client);
};

// --- ROUTES ---

// GET: Fetch all tasks
app.get('/todos', async (c) => {
  const db = getDb(c.env);
  try {
    const allTodos = await db.select().from(todos).all();
    return c.json(allTodos);
  } catch (error) {
    return c.json({ error: 'Failed to fetch todos' }, 500);
  }
});

// POST: Add a new task
app.post('/todos', async (c) => {
  const db = getDb(c.env);
  const { text } = await c.req.json();
  
  if (!text) return c.json({ error: 'Text is required' }, 400);

  try {
    const newTodo = await db.insert(todos).values({ text }).returning();
    return c.json(newTodo[0]);
  } catch (error) {
    return c.json({ error: 'Failed to create todo' }, 500);
  }
});

// DELETE: Remove a task
app.delete('/todos/:id', async (c) => {
  const db = getDb(c.env);
  const id = c.req.param('id');
  
  try {
    await db.delete(todos).where(eq(todos.id, Number(id)));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Failed to delete todo' }, 500);
  }
});

export default app;