// Migration runner (Phase 3). Applies db/migrations/*.sql in order against the
// Postgres pointed to by DATABASE_URL, tracking applied versions in a
// schema_migrations table so it is idempotent and re-runnable.
//
// Usage: DATABASE_URL=postgres://... npm run migrate

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString });

  try {
    await pool.query(
      `create table if not exists schema_migrations (
         version text primary key,
         applied_at timestamptz not null default now()
       )`,
    );

    const applied = new Set(
      (await pool.query<{ version: string }>("select version from schema_migrations")).rows.map(
        (r) => r.version,
      ),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip   ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into schema_migrations (version) values ($1)", [file]);
        await client.query("commit");
        console.log(`  apply  ${file}`);
        count += 1;
      } catch (err) {
        await client.query("rollback");
        throw new Error(`Migration failed: ${file}\n${err instanceof Error ? err.message : err}`);
      } finally {
        client.release();
      }
    }
    console.log(`Migrations complete. ${count} applied, ${files.length - count} skipped.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
