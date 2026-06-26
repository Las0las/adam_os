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

// Supabase (and some other hosts) emit DATABASE_URL with sslmode=require.
// pg-connection-string v2 treats require/prefer/verify-ca as aliases for
// verify-full, but will adopt weaker libpq semantics in v3 (pg v9), so it
// emits a SECURITY WARNING in the meantime.  Normalise to verify-full
// at construction time so the warning is silenced and the future upgrade is safe.
function normalizeConnectionString(url: string): string {
  return url.replace(/sslmode=(prefer|require|verify-ca)/g, "sslmode=verify-full");
}

export function getDb(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL ?? "";
    pool = new Pool({ connectionString: url ? normalizeConnectionString(url) : url });
  }
  return pool;
}
