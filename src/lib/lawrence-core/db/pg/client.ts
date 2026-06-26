// Postgres connection pool (Phase 2 §20). This is the PRODUCTION persistence
// seam: with DATABASE_URL set and the db/migrations applied, the repository
// layer below runs against Postgres. The default local/test runtime uses the
// in-memory Collection store (../index.ts) so the platform is runnable with no
// external services. Selection is by presence of DATABASE_URL.

import { Pool, type PoolClient, type QueryResult } from "pg";

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

/**
 * Run `fn` inside a transaction on a single pinned connection with the
 * transaction-local `app.tenant_id` GUC set. This is the seam that drives
 * row-level security: every runtime read/write is scoped to one tenant for the
 * life of the transaction, and the setting resets on commit/rollback so it can
 * never leak across pooled checkouts. A null/empty tenant sets an empty GUC,
 * under which RLS-enabled tables expose no rows (fail closed).
 */
export async function withTenantTx<R>(
  tenantId: string | null,
  fn: (client: PoolClient) => Promise<R>,
): Promise<R> {
  const client = await getDb().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.tenant_id', $1, true)", [tenantId ?? ""]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      /* ignore rollback failure; surface the original error */
    }
    throw err;
  } finally {
    client.release();
  }
}

export type { PoolClient, QueryResult };
