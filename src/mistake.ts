import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { Bindings } from './types';

// Define the shape of the data we expect from the frontend
type MistakeBody = {
  text: string;
};

// Create a Hono instance typed with your Bindings
const app = new Hono<{ Bindings: Bindings }>();

// Helper function to initialize Supabase using the environment variables
const getSupabase = (env: Bindings) => {
  return createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
};

// 1. GET /mistake - List all mistakes
app.get('/', async (c) => {
  const supabase = getSupabase(c.env);
  
  const { data, error } = await supabase
    .from('mistakes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json(data);
});

// 2. POST /mistake - Create a new mistake
app.post('/', async (c) => {
  const supabase = getSupabase(c.env);
  const body = await c.req.json<MistakeBody>();

  if (!body.text) {
    return c.json({ error: 'Text is required' }, 400);
  }

  const { data, error } = await supabase
    .from('mistakes')
    .insert([{ text: body.text }])
    .select();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json(data[0], 201);
});

// 3. PUT /mistake/:id - Update a mistake
app.put('/:id', async (c) => {
  const supabase = getSupabase(c.env);
  const id = c.req.param('id');
  const body = await c.req.json<MistakeBody>();

  const { data, error } = await supabase
    .from('mistakes')
    .update({ text: body.text })
    .eq('id', id)
    .select();

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json(data[0]);
});

// 4. DELETE /mistake/:id - Delete a mistake
app.delete('/:id', async (c) => {
  const supabase = getSupabase(c.env);
  const id = c.req.param('id');

  const { error } = await supabase
    .from('mistakes')
    .delete()
    .eq('id', id);

  if (error) {
    return c.json({ error: error.message }, 500);
  }
  return c.json({ success: true });
});

export default app;