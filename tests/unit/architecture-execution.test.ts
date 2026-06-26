// Architecture enforcement (Milestone 4.5). The execution pipeline is the only
// place a provider may be invoked, and provider adapter classes may only be
// imported by their registrations. These tests fail if a future change adds a
// bypass.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true })
    .map((f) => String(f))
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => f.replace(/\\/g, "/"));
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

// Files permitted to call `.complete()` — the pipeline, and the provider layer's
// own metered wrapper (which delegates to the active provider).
const COMPLETE_ALLOWED = [
  "lib/aiops/execution/inference-pipeline.ts",
  "lib/aiops/models/model-provider.ts",
];

test("only the execution pipeline invokes a provider (.complete)", () => {
  const offenders: string[] = [];
  for (const rel of sourceFiles()) {
    if (COMPLETE_ALLOWED.some((a) => rel.endsWith(a))) continue;
    if (/\.complete\(/.test(stripComments(readFileSync(join(SRC, rel), "utf8")))) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], `direct provider .complete() outside the execution pipeline: ${offenders.join(", ")}`);
});

// Adapter classes (…-client) may only be imported by the provider layer: the
// integrations dir itself and the registry registrations. NOT the router, NOT
// applications — they go through the registry + pipeline.
const ADAPTER_IMPORT = /from\s+["']@\/lib\/integrations\/[a-z0-9-]+\/[a-z0-9-]+-client["']/;

test("provider adapters are imported only by their registrations", () => {
  const offenders: string[] = [];
  for (const rel of sourceFiles()) {
    if (rel.startsWith("lib/integrations/")) continue; // the adapter layer
    if (rel.startsWith("lib/aiops/providers/registrations/")) continue; // sanctioned
    if (ADAPTER_IMPORT.test(readFileSync(join(SRC, rel), "utf8"))) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `direct adapter import outside the provider layer: ${offenders.join(", ")}`);
});

test("the router selects providers via the registry, not adapter classes", () => {
  const router = readFileSync(join(SRC, "lib/aiops/models/model-router.ts"), "utf8");
  assert.ok(!ADAPTER_IMPORT.test(router), "model-router must not import adapter classes directly");
  assert.match(router, /provider-registry/, "model-router resolves through the registry");
});
