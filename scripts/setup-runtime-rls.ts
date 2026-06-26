// Privileged setup for the two-role RLS deployment. Run ONCE (and after adding
// new runtime collections) as a role that owns / can create the rt_* tables —
// typically the same DATABASE_URL used by `npm run migrate`.
//
//   DATABASE_URL=postgres://owner:...  LAWRENCE_DB_APP_ROLE=lawrence_app \
//     npx tsx scripts/setup-runtime-rls.ts
//
// It (1) creates every runtime table the app expects, (2) applies row-level
// security + the tenant-isolation policy (db/migrations/0015), and (3) grants the
// non-superuser app role used by the running app. The app then connects with
// that app role's DATABASE_URL and LAWRENCE_DB_MANAGED_SCHEMA=1.
//
// The app role itself must already exist (create it once, per your secret
// management), e.g.:  create role lawrence_app login password '...' nosuperuser;

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { db } from "@/lib/lawrence-core/db";
import type { Collection } from "@/lib/lawrence-core/db/collection";

const MIGRATION = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "db",
  "migrations",
  "0015_runtime_rls.sql",
);

function runtimeTableNames(): string[] {
  // Single source of truth: every Collection knows its base name.
  return Object.values(db).map((c) => `rt_${(c as Collection<never>).name}`);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const appRole = process.env.LAWRENCE_DB_APP_ROLE ?? "";

  const pool = new Pool({ connectionString: url });
  try {
    const tables = runtimeTableNames();
    for (const table of tables) {
      await pool.query(
        `create table if not exists ${table} (
           id text primary key,
           tenant_id text not null,
           data jsonb not null
         )`,
      );
      await pool.query(`create index if not exists ${table}_tenant_idx on ${table} (tenant_id)`);
    }
    // Define + run the RLS apply function (idempotent).
    await pool.query(readFileSync(MIGRATION, "utf8"));
    await pool.query("select lawrence_apply_runtime_rls($1)", [appRole || null]);

    // eslint-disable-next-line no-console
    console.log(
      `Applied RLS to ${tables.length} runtime tables` +
        (appRole ? `; granted to role "${appRole}".` : " (no app role granted — set LAWRENCE_DB_APP_ROLE)."),
    );
  } finally {
    await pool.end();
  }
}

void main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
