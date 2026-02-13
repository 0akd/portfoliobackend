// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Import the middleware
import { verifyAuth } from './auth.js'; 

// Import Routes
import todos from './todos.js';
import vault from './vault.js';
import mistake from './mistake.js';
import correctness from './correctness.js';
import courses from './courses.js';
import temptodo from './temptodo.js';

const app = new Hono();

// CORS Configuration
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], 
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// --- PROTECT ROUTES ---
// Apply middleware to specific paths
app.use('/todos/*', verifyAuth);
app.use('/vault/*', verifyAuth);
app.use('/mistake/*', verifyAuth);
app.use('/temptodo/*', verifyAuth);
app.use('/correctness/*', verifyAuth);
// Courses remains public (optional)
// app.use('/courses/*', verifyAuth);

// --- MOUNT ROUTES ---
app.route('/todos', todos);
app.route('/vault', vault);
app.route('/mistake', mistake);
app.route('/correctness', correctness);
app.route('/courses', courses);
app.route('/temptodo', temptodo);

export default app;