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

function intEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getDb(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL ?? "";
    pool = new Pool({
      connectionString: url ? normalizeConnectionString(url) : url,
      // Production pool sizing / timeouts. Defaults are conservative and suit a
      // single serverless instance; tune per deployment via env.
      max: intEnv("DATABASE_POOL_MAX", 10),
      idleTimeoutMillis: intEnv("DATABASE_POOL_IDLE_MS", 30_000),
      connectionTimeoutMillis: intEnv("DATABASE_POOL_CONNECT_MS", 10_000),
    });
    // An idle client emitting 'error' (server-side disconnect, network drop)
    // terminates the process by default. Log and let the pool evict and
    // recreate the client instead of crashing the runtime.
    pool.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error(`[pg] idle client error: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
  return pool;
}
