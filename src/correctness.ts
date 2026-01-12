import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from './types';

// Define the shape of the data
type CorrectnessBody = {
  text: string;
};

// Create a Hono instance
const app = new Hono<{ Bindings: Bindings }>();

// Helper function to initialize Supabase
const getSupabase = (env: Bindings) => {
  return createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
};

// 1. GET /correctness - List all entries
app.get('/', async (c) => {
  const supabase = getSupabase(c.env);
  
  const { data, error } = await supabase
    .from('correctness_diary')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json(data);
});

// 2. POST /correctness - Create a new entry
app.post('/', async (c) => {
  const supabase = getSupabase(c.env);
  const body = await c.req.json<CorrectnessBody>();

  if (!body.text) {
    return c.json({ error: 'Text is required' }, 400);
  }

  const { data, error } = await supabase
    .from('correctness_diary')
    .insert([{ text: body.text }])
    .select();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json(data[0], 201);
});

// 3. PUT /correctness/:id - Update an entry
app.put('/:id', async (c) => {
  const supabase = getSupabase(c.env);
  const id = c.req.param('id');
  const body = await c.req.json<CorrectnessBody>();

  const { data, error } = await supabase
    .from('correctness_diary')
    .update({ text: body.text })
    .eq('id', id)
    .select();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json(data[0]);
});

// 4. DELETE /correctness/:id - Delete an entry
app.delete('/:id', async (c) => {
  const supabase = getSupabase(c.env);
  const id = c.req.param('id');

  const { error } = await supabase
    .from('correctness_diary')
    .delete()
    .eq('id', id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json({ success: true });
});

export default app;