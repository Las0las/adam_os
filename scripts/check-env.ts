// Phase 9 — env check CLI. Thin wrapper over preflight for `npm run check-env`.
import { runPreflight } from "./preflight";

const result = runPreflight();
for (const c of result.checks) {
  // eslint-disable-next-line no-console
  console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.key}: ${c.detail}`);
}
process.exit(result.ok ? 0 : 1);
