// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/web';
import { todos, todoHistory } from './schema.js';
import { eq, desc, asc, sql } from 'drizzle-orm';

const app = new Hono();

// Enable Cross-Origin Resource Sharing
app.use('/*', cors());

// --- DATABASE CONNECTION ---
const getDb = (env: any) => {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  return drizzle(client);
};

// --- HELPERS ---

// Normalizes strings (e.g. " urgent " -> "Urgent")
const normalize = (str: string) => 
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();

// Cleans arrays to ensure they are valid lists of strings
const cleanArray = (arr: any) => {
  if (!Array.isArray(arr)) return [];
  return arr.filter(i => i && typeof i === 'string' && i.trim() !== "");
};

// --- ROUTES ---

// 1. GET: Fetch Tasks + Session History
app.get('/todos', async (c) => {
  const db = getDb(c.env);

  try {
    const allTodos = await db.select()
      .from(todos)
      .orderBy(asc(todos.priority))
      .all();

    const recentSessions = await db.select({
        sessionId: todoHistory.sessionId,
        timestamp: sql<string>`MAX(${todoHistory.timestamp})`.as('timestamp')
      })
      .from(todoHistory)
      .groupBy(todoHistory.sessionId)
      .orderBy(desc(sql`MAX(${todoHistory.timestamp})`))
      .limit(7)
      .all();

    const sessionIds = recentSessions.map(s => s.sessionId);

    let historyLogs: any[] = [];
    if (sessionIds.length > 0) {
      historyLogs = await db.select()
        .from(todoHistory)
        .where(sql`${todoHistory.sessionId} IN ${sessionIds}`)
        .all();
    }

    const result = allTodos.map((t) => ({
      ...t,
      history: historyLogs.filter((h) => h.todoId === t.id)
    }));

    return c.json({
      tasks: result,
      sessions: recentSessions
    });

  } catch (error) {
    console.error('Fetch Error:', error);
    return c.json({ error: 'Failed to fetch data' }, 500);
  }
});

// 2. POST: Create New Task
app.post('/todos', async (c) => {
  const db = getDb(c.env);
  const body = await c.req.json();
  const { text, priority } = body;
  
  if (!text) return c.json({ error: 'Text is required' }, 400);

  const category = cleanArray(body.category).map((c: string) => normalize(c.trim()));
  const requiredItems = cleanArray(body.requiredItems);
  const procedure = cleanArray(body.procedure);

  try {
    let newPriority = 0;

    // Shift existing tasks down if inserting at specific priority
    if (priority !== undefined && priority !== null) {
      await db.run(sql`UPDATE todos SET priority = priority + 1 WHERE priority >= ${priority}`);
      newPriority = priority;
    } else {
      const maxP = await db.select({ value: sql<number>`MAX(priority)` }).from(todos).get();
      newPriority = (maxP?.value || 0) + 1;
    }

    const newTodo = await db.insert(todos).values({
      text,
      category,
      requiredItems,
      procedure,
      priority: newPriority,
      completed: false
    }).returning();

    return c.json(newTodo[0]);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to create todo' }, 500);
  }
});

// 3. PATCH: Update Task Details (Text, Items, Procedure, Category, Priority)
app.patch('/todos/:id', async (c) => {
  const db = getDb(c.env);
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  
  const updateData: any = {};
  
  // Map standard fields
  if (body.text !== undefined) updateData.text = body.text;
  if (body.category !== undefined) updateData.category = cleanArray(body.category);
  if (body.requiredItems !== undefined) updateData.requiredItems = cleanArray(body.requiredItems);
  if (body.procedure !== undefined) updateData.procedure = cleanArray(body.procedure);

  try {
    // === FIX START: Handle Priority Updates ===
    if (body.priority !== undefined) {
      const newPriority = Number(body.priority);
      // Shift other tasks down to make a "hole" for this task
      await db.run(sql`UPDATE todos SET priority = priority + 1 WHERE priority >= ${newPriority} AND id != ${id}`);
      updateData.priority = newPriority;
    }
    // === FIX END ===

    // Prevent crashing if payload is empty
    if (Object.keys(updateData).length === 0) {
      return c.json({ success: true, message: "No changes detected" });
    }

    await db.update(todos).set(updateData).where(eq(todos.id, id));
    return c.json({ success: true });
  } catch (error) {
    console.error("Update Error:", error);
    return c.json({ error: 'Update failed' }, 500);
  }
});

// 4. PATCH: Toggle Completion Status
app.patch('/todos/:id/toggle', async (c) => {
  const db = getDb(c.env);
  const id = Number(c.req.param('id'));
  const { completed } = await c.req.json();

  await db.update(todos).set({ completed }).where(eq(todos.id, id));
  return c.json({ success: true });
});

// 5. POST: GLOBAL RESET (Start New Session)
app.post('/todos/reset', async (c) => {
  const db = getDb(c.env);
  const sessionId = crypto.randomUUID(); 
  const timestamp = new Date().toISOString();

  try {
    const allTodos = await db.select().from(todos).all();

    if (allTodos.length > 0) {
      const historyEntries = allTodos.map((t) => ({
        todoId: t.id,
        timestamp: timestamp,
        sessionId: sessionId,
        completed: t.completed
      }));
      
      await db.insert(todoHistory).values(historyEntries);
    }

    await db.update(todos).set({ completed: false });

    return c.json({ success: true, message: "Session saved" });
  } catch (error) {
    return c.json({ error: 'Reset failed' }, 500);
  }
});

// 6. DELETE: Remove Task
app.delete('/todos/:id', async (c) => {
  const db = getDb(c.env);
  const id = Number(c.req.param('id'));
  
  try {
    await db.delete(todoHistory).where(eq(todoHistory.todoId, id));
    await db.delete(todos).where(eq(todos.id, id));
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Delete failed' }, 500);
  }
});

export default app;