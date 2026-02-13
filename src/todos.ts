import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/web';
import { todos, todoHistory } from './schema.js';
import { eq, desc, asc, sql, and } from 'drizzle-orm';

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
}

const app = new Hono<{ Bindings: Bindings }>();

const getDb = (env: Bindings) => {
  const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
  return drizzle(client);
};

const normalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
const cleanArray = (arr: any) => (!Array.isArray(arr) ? [] : arr.filter((i: any) => i && typeof i === 'string' && i.trim() !== ""));

// ... imports and existing setup ...

// --- EXPORT (Already working, but good to verify) ---
app.get('/export', async (c) => {
  const db = getDb(c.env);
  try {
    // Drizzle with mode: 'json' returns these fields as Arrays (parsed JSON)
    const allTodos = await db.select().from(todos).all();
    const allHistory = await db.select().from(todoHistory).all();
    return c.json({ todos: allTodos, history: allHistory });
  } catch (error) {
    return c.json({ error: 'Export failed' }, 500);
  }
});

// --- IMPORT (NEEDS UPDATE) ---
app.post('/import', async (c) => {
  const db = getDb(c.env);
  const body = await c.req.json();
  const { todos: newTodos, history: newHistory } = body;

  if (!Array.isArray(newTodos) || !Array.isArray(newHistory)) {
    return c.json({ error: 'Invalid backup format' }, 400);
  }

  try {
    await db.delete(todoHistory).run();
    await db.delete(todos).run();

    if (newTodos.length > 0) {
      // PRE-PROCESSING: Ensure JSON fields are handled correctly
      // Drizzle insert expects the value to be the Object/Array if mode='json' is set in schema
      // OR a string if we were doing raw SQL. Since we use db.insert(todos), we pass the Array.
      
      const cleanTodos = newTodos.map((t: any) => {
          // If the exported file has them as strings (e.g. legacy export), parse them.
          // If they are already arrays (standard export), keep them.
          let sub = t.subtasks;
          let req = t.requiredItems;
          let proc = t.procedure;

          if (typeof sub === 'string') try { sub = JSON.parse(sub) } catch(e) { sub = [] }
          if (typeof req === 'string') try { req = JSON.parse(req) } catch(e) { req = [] }
          if (typeof proc === 'string') try { proc = JSON.parse(proc) } catch(e) { proc = [] }

          return {
              ...t,
              // Drizzle will stringify these automatically because schema has { mode: 'json' }
              subtasks: sub || [],
              requiredItems: req || [],
              procedure: proc || []
          };
      });

      await db.insert(todos).values(cleanTodos).run();
    }
    
    if (newHistory.length > 0) {
      await db.insert(todoHistory).values(newHistory).run();
    }

    return c.json({ success: true, count: newTodos.length });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Import failed' }, 500);
  }
});

// ... rest of your routes (PATCH history, GET, POST, RESET, PATCH id, TOGGLE, DELETE) ...
// 1. HISTORY ROUTE
app.patch('/history/:todoId/:sessionId', async (c) => {
  const db = getDb(c.env);
  const todoId = Number(c.req.param('todoId'));
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json();

  const updateData: any = {};
  if (body.snapshotCounter !== undefined) updateData.snapshotCounter = Number(body.snapshotCounter);
  if (body.snapshotTimer !== undefined) updateData.snapshotTimer = Number(body.snapshotTimer);
  if (body.completed !== undefined) updateData.completed = body.completed;

  try {
    const result = await db.update(todoHistory)
      .set(updateData)
      .where(and(eq(todoHistory.todoId, todoId), eq(todoHistory.sessionId, sessionId)))
      .returning();
    return c.json({ success: true, updated: result });
  } catch (error) { return c.json({ error: 'History update failed' }, 500); }
});

// 2. GET TASKS
app.get('/', async (c) => {
  const db = getDb(c.env);
  try {
    const allTodos = await db.select().from(todos).orderBy(asc(todos.priority)).all();
    
    const recentSessions = await db.select({
        sessionId: todoHistory.sessionId,
        timestamp: sql<string>`MAX(${todoHistory.timestamp})`.as('timestamp')
      }).from(todoHistory)
      .groupBy(todoHistory.sessionId)
      .orderBy(desc(sql`MAX(${todoHistory.timestamp})`))
      .limit(7).all();

    const sessionIds = recentSessions.map(s => s.sessionId);
    let historyLogs: any[] = [];
    if (sessionIds.length > 0) {
      historyLogs = await db.select().from(todoHistory).where(sql`${todoHistory.sessionId} IN ${sessionIds}`).all();
    }

    const result = allTodos.map((t) => ({
      ...t,
      history: historyLogs.filter((h) => h.todoId === t.id)
    }));

    return c.json({ tasks: result, sessions: recentSessions });
  } catch (error) { return c.json({ error: 'Fetch failed' }, 500); }
});

// 3. CREATE TASK (Simple String)
app.post('/', async (c) => { 
  const db = getDb(c.env);
  const body = await c.req.json();
  const { text, priority, unit, category } = body; 
  if (!text) return c.json({ error: 'Text required' }, 400);

  try {
    let newPriority = 0;
    if (priority !== undefined && priority !== null) {
      await db.run(sql`UPDATE todos SET priority = priority + 1 WHERE priority >= ${priority}`);
      newPriority = priority;
    } else {
      const maxP = await db.select({ value: sql<number>`MAX(priority)` }).from(todos).get();
      newPriority = (maxP?.value || 0) + 1;
    }

    const newTodo = await db.insert(todos).values({
      text,
      unit: unit || 'units', 
      // STORE AS STRING DIRECTLY
      category: category ? normalize(category.toString().trim()) : '',
      priority: newPriority,
      activeCounter: 0,
      activeTimer: 0
    }).returning();
    return c.json(newTodo[0]);
  } catch (error) { return c.json({ error: 'Create failed' }, 500); }
});

// 4. RESET
app.post('/reset', async (c) => {
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
        completed: t.completed,
        snapshotCounter: t.activeCounter,
        snapshotTimer: t.activeTimer
      }));
      await db.insert(todoHistory).values(historyEntries);
    }
    await db.update(todos).set({ completed: false, activeCounter: 0, activeTimer: 0 });
    return c.json({ success: true });
  } catch (error) { return c.json({ error: 'Reset failed' }, 500); }
});

const cleanSubtasks = (arr: any) => {
    if (!Array.isArray(arr)) return [];
    return arr.map((s: any) => ({
        id: s.id || crypto.randomUUID(),
        text: String(s.text || ""),
        completed: Boolean(s.completed)
    })).filter(s => s.text.trim() !== "");
};




app.patch('/:id', async (c) => { 
  const db = getDb(c.env);
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  
  const updateData: any = {};
  if (body.text !== undefined) updateData.text = body.text;
  if (body.unit !== undefined) updateData.unit = body.unit;
  if (body.category !== undefined) updateData.category = body.category ? normalize(body.category.toString().trim()) : '';
  if (body.activeCounter !== undefined) updateData.activeCounter = Number(body.activeCounter);
  if (body.activeTimer !== undefined) updateData.activeTimer = Number(body.activeTimer);
  
  if (body.requiredItems !== undefined) updateData.requiredItems = JSON.stringify(cleanArray(body.requiredItems));
  if (body.procedure !== undefined) updateData.procedure = JSON.stringify(cleanArray(body.procedure));
  
  // NEW: Handle subtasks
  if (body.subtasks !== undefined) updateData.subtasks = JSON.stringify(cleanSubtasks(body.subtasks));

  try {
    if (body.priority !== undefined) {
      const newPriority = Number(body.priority);
      await db.run(sql`UPDATE todos SET priority = priority + 1 WHERE priority >= ${newPriority} AND id != ${id}`);
      updateData.priority = newPriority;
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(todos).set(updateData).where(eq(todos.id, id)).run();
    }
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: 'Update failed' }, 500);
  }
});
// 6. TOGGLE
app.patch('/:id/toggle', async (c) => { 
  const db = getDb(c.env);
  const id = Number(c.req.param('id'));
  const { completed } = await c.req.json();
  await db.update(todos).set({ completed }).where(eq(todos.id, id));
  return c.json({ success: true });
});

// 7. DELETE
app.delete('/:id', async (c) => { 
  const db = getDb(c.env);
  const id = Number(c.req.param('id'));
  try {
    await db.delete(todoHistory).where(eq(todoHistory.todoId, id));
    await db.delete(todos).where(eq(todos.id, id));
    return c.json({ success: true });
  } catch (error) { return c.json({ error: 'Delete failed' }, 500); }
});

export default app;