// src/types.ts
export type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
  BACKUP_SECRET: string;
  // NEW: Add Supabase keys
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
};