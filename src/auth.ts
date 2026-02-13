// src/auth.ts
import type { Context, Next } from 'hono';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// YOUR HARDCODED PROJECT ID
const PROJECT_ID = "website-4c04f";

// Google's public keys
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export const verifyAuth = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: No token provided' }, 401);
  }

  // Extract the token
  const token = authHeader.split('Bearer ')[1];

  // FIX: Explicitly check if token is undefined to satisfy TypeScript
  if (!token) {
    return c.json({ error: 'Unauthorized: Malformed token' }, 401);
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });

    c.set('user', payload);
    await next();
  } catch (error) {
    console.error('Auth Error:', error);
    return c.json({ error: 'Unauthorized: Invalid token' }, 401);
  }
};