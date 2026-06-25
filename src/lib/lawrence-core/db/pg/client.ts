// Postgres connection pool (Phase 2 §20). This is the PRODUCTION persistence
// seam: with DATABASE_URL set and the db/migrations applied, the repository
// layer below runs against Postgres. The default local/test runtime uses the
// in-memory Collection store (../index.ts) so the platform is runnable with no
// external services. Selection is by presence of DATABASE_URL.

import { Pool } from "pg";

let pool: Pool | null = null;

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}
