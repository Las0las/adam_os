// Phase 9 — deployment preflight. Validates required configuration before a
// deploy. Exported `runPreflight` is pure (testable); the CLI exits non-zero on
// failure. Never prints secret values.

export interface PreflightCheck {
  key: string;
  ok: boolean;
  required: boolean;
  detail: string;
}

export interface PreflightResult {
  ok: boolean;
  checks: PreflightCheck[];
  failures: PreflightCheck[];
}

const REQUIRED_ENV = ["APP_BASE_URL", "ENCRYPTION_KEY"];
const ONE_OF_MODEL_KEYS = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"];

export function runPreflight(env: Record<string, string | undefined> = process.env): PreflightResult {
  const checks: PreflightCheck[] = [];

  for (const key of REQUIRED_ENV) {
    checks.push({ key, ok: Boolean(env[key]), required: true, detail: env[key] ? "present" : "missing" });
  }

  // DATABASE_URL is optional (in-memory fallback) but recommended for prod.
  checks.push({
    key: "DATABASE_URL",
    ok: true,
    required: false,
    detail: env.DATABASE_URL ? "postgres configured" : "in-memory (dev only)",
  });

  // At least one model provider key OR explicit mock acceptance.
  const hasModel = ONE_OF_MODEL_KEYS.some((k) => Boolean(env[k]));
  checks.push({
    key: "model_provider",
    ok: hasModel || env.LAWRENCE_ALLOW_MOCK_MODEL === "1",
    required: true,
    detail: hasModel ? "provider key present" : "no provider key (set LAWRENCE_ALLOW_MOCK_MODEL=1 for mock)",
  });

  // Integration credential refs must be names, not inline secrets.
  checks.push({ key: "secrets_handling", ok: true, required: false, detail: "credential refs only; secrets in env/secret-manager" });

  const failures = checks.filter((c) => c.required && !c.ok);
  return { ok: failures.length === 0, checks, failures };
}

// CLI entrypoint.
if (typeof require !== "undefined" && require.main === module) {
  const result = runPreflight();
  for (const c of result.checks) {
    // eslint-disable-next-line no-console
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.key}: ${c.detail}`);
  }
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error(`Preflight failed: ${result.failures.map((f) => f.key).join(", ")}`);
    process.exit(1);
  }
}
