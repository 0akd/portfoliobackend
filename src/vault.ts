import { Hono } from 'hono';
import { cors } from 'hono/cors'; 
import { createClient } from '@supabase/supabase-js';

export interface Bindings {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
}

const app = new Hono<{ Bindings: Bindings }>();

// Allow large payloads if your environment supports configuration, 
// but chunking on frontend is the real fix.
app.use('/*', cors());

const getSupabase = (env: Bindings) => {
  return createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
};

// ... (Keep GET / and GET /backup as they were) ...
app.get('/', async (c) => {
  const supabase = getSupabase(c.env);
  const parentId = c.req.query('parentId');
  let query = supabase.from('vault').select('*');
  if (!parentId || parentId === 'null' || parentId === 'root') {
    query = query.is('parent_id', null);
  } else {
    query = query.eq('parent_id', parentId);
  }
  const { data, error } = await query.order('type', { ascending: false }).order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.put('/', async (c) => {
  const supabase = getSupabase(c.env);
  const body = await c.req.json(); 
  const { name, value, type, parent_id } = body;
  const { data, error } = await supabase.from('vault').insert({ name, value, type, parent_id: parent_id || null }).select();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.patch('/:id', async (c) => {
  const supabase = getSupabase(c.env);
  const id = c.req.param('id');
  const { name } = await c.req.json();
  const { data, error } = await supabase.from('vault').update({ name }).eq('id', id).select();
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

app.delete('/:id', async (c) => {
  const supabase = getSupabase(c.env);
  const id = c.req.param('id');
  const { error } = await supabase.from('vault').delete().eq('id', id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

app.get('/backup', async (c) => {
  const supabase = getSupabase(c.env);
  const { data, error } = await supabase.from('vault').select('*');
  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

/**
 * POST /import
 * SIMPLIFIED: Accepts a chunk of items and inserts them directly.
 * The Frontend now handles the ID generation and Mapping.
 */
app.post('/import', async (c) => {
  const supabase = getSupabase(c.env);
  const { items } = await c.req.json();

  if (!items || !Array.isArray(items)) {
    return c.json({ error: 'Invalid data' }, 400);
  }

  // Direct insert. The Frontend has already ensured IDs are unique and parents are correct.
  const { error } = await supabase.from('vault').insert(items);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

export default app;