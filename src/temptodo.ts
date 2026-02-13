// src/temptodo.ts
import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from './types';

type TodoBody = {
  text: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const getSupabase = (env: Bindings) => {
  return createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
};

// 1. GET / - List all
app.get('/', async (c) => {
  const supabase = getSupabase(c.env);
  const { data, error } = await supabase
    .from('temptodo') // <--- CHANGED TABLE NAME
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// 2. POST / - Create
app.post('/', async (c) => {
  const supabase = getSupabase(c.env);
  const body = await c.req.json<TodoBody>();

  if (!body.text) return c.json({ error: 'Text is required' }, 400);

  const { data, error } = await supabase
    .from('temptodo') // <--- CHANGED TABLE NAME
    .insert([{ text: body.text }])
    .select();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data[0], 201);
});

// 3. PUT /:id - Update
app.put('/:id', async (c) => {
  const supabase = getSupabase(c.env);
  const id = c.req.param('id');
  const body = await c.req.json<TodoBody>();

  const { data, error } = await supabase
    .from('temptodo') // <--- CHANGED TABLE NAME
    .update({ text: body.text })
    .eq('id', id)
    .select();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data[0]);
});

// 4. DELETE /:id - Delete
app.delete('/:id', async (c) => {
  const supabase = getSupabase(c.env);
  const id = c.req.param('id');

  const { error } = await supabase
    .from('temptodo') // <--- CHANGED TABLE NAME
    .delete()
    .eq('id', id);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

export default app;