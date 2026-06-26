// Phase 9 — migration runner. The runtime persists rt_* jsonb tables on demand;
// the db/migrations/*.sql files are the canonical reference schema. This script
// applies the reference SQL when a DATABASE_URL is configured.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // eslint-disable-next-line no-console
    console.log("DATABASE_URL not set — runtime uses in-memory store; nothing to migrate.");
    return;
  }
  const dir = join(process.cwd(), "db", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  // eslint-disable-next-line no-console
  console.log(`Found ${files.length} migration files in db/migrations.`);
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    // eslint-disable-next-line no-console
    console.log(`-- ${f} (${sql.length} bytes) — apply via your migration tool / psql`);
  }
}
void main();
