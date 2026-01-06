// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import todos from './todos.js';
import vault from './vault.js'; // Import the new vault file

const app = new Hono();

app.use('/*', cors());

// Existing Todos route
app.route('/todos', todos);

// NEW: Mount the vault app at '/vault'
app.route('/vault', vault); 

export default app;