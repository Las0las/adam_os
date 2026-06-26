// Phase 9 — healthcheck CLI. Hits GET /api/health and exits non-zero if not ok.
const base = process.env.APP_BASE_URL ?? "http://localhost:3000";

async function main(): Promise<void> {
  try {
    const res = await fetch(`${base}/api/health`);
    const body = (await res.json()) as { ok?: boolean };
    // eslint-disable-next-line no-console
    console.log(`health: ${res.status} ok=${body.ok}`);
    process.exit(res.ok && body.ok ? 0 : 1);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`healthcheck failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
