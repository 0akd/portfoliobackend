import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';

// Define Types
type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
};

type Section = {
  type: 'video' | 'pdf' | 'link';
  url: string;
  label?: string;
};

type CourseBody = {
  title: string;
  description: string;
  sections: Section[];
};

// Create a sub-application
const app = new Hono<{ Bindings: Bindings }>();

// Helper for Supabase
const getSupabase = (env: Bindings) => createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

// --- 1. UTILITY ROUTES (MUST BE DEFINED FIRST) ---

// GET /utils/proxy-pdf
// Use this to bypass CORS when loading PDFs from external domains
app.get('/utils/proxy-pdf', async (c) => {
  const url = c.req.query('url');
  if (!url) return c.text('Missing URL', 400);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Compatible; HonoProxy/1.0)' }
    });

    if (!response.ok) return c.text(`Source Error: ${response.statusText}`, 502);

    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Content-Type', 'application/pdf');
    newHeaders.delete('X-Frame-Options');

    return new Response(response.body, { status: 200, headers: newHeaders });
  } catch (err) {
    return c.text('Proxy Error', 500);
  }
});

// GET /utils/progress - Get reading position
app.get('/utils/progress', async (c) => {
  const supabase = getSupabase(c.env);
  const url = c.req.query('url');

  if (!url) return c.json({ error: 'URL required' }, 400);

  const { data, error } = await supabase
    .from('progress')
    .select('page_number')
    .eq('resource_url', url)
    .single();

  if (error || !data) return c.json({ page_number: 1 });
  return c.json(data);
});

// POST /utils/progress - Save reading position
app.post('/utils/progress', async (c) => {
  const supabase = getSupabase(c.env);
  const { url, page } = await c.req.json();

  if (!url || !page) return c.json({ error: 'Missing data' }, 400);

  const { error } = await supabase
    .from('progress')
    .upsert(
      { resource_url: url, page_number: page, updated_at: new Date() },
      { onConflict: 'resource_url' }
    );

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});

// --- 2. COURSE CRUD OPERATIONS ---

// GET / - List all courses
app.get('/', async (c) => {
  const supabase = getSupabase(c.env);
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// GET /:id - Get single course
// (This is defined AFTER utils so it doesn't catch "/utils" as an ID)
app.get('/:id', async (c) => {
  const supabase = getSupabase(c.env);
  const id = c.req.param('id');

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return c.json({ error: error.message }, 404);
  return c.json(data);
});

// POST / - Create course
app.post('/', async (c) => {
  const supabase = getSupabase(c.env);
  const body = await c.req.json<CourseBody>();

  if (!body.title || !body.sections) return c.json({ error: 'Title/Sections required' }, 400);

  const { data, error } = await supabase
    .from('courses')
    .insert([{ 
      title: body.title, 
      description: body.description, 
      sections: body.sections 
    }])
    .select();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data[0], 201);
});

// PUT /:id - Update course
app.put('/:id', async (c) => {
  const supabase = getSupabase(c.env);
  const id = c.req.param('id');
  const body = await c.req.json<CourseBody>();

  const { data, error } = await supabase
    .from('courses')
    .update({ 
      title: body.title, 
      description: body.description, 
      sections: body.sections 
    })
    .eq('id', id)
    .select();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data[0]);
});

// DELETE /:id - Delete course
app.delete('/:id', async (c) => {
  const supabase = getSupabase(c.env);
  const id = c.req.param('id');
  const { error } = await supabase.from('courses').delete().eq('id', id);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ message: 'Deleted' });
});

export default app;