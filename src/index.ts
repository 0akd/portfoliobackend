import { Hono } from 'hono';
import { cors } from 'hono/cors';

// FIX: Append .js to all local imports
import todos from './todos.js';
import vault from './vault.js';
import mistake from './mistake.js';
import correctness from './correctness.js';
import courses from './courses.js';

const app = new Hono();

// 1. Global CORS
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// 2. Mount Routes
app.route('/todos', todos);
app.route('/vault', vault);
app.route('/mistake', mistake);
app.route('/correctness', correctness);
app.route('/courses', courses);

export default app;