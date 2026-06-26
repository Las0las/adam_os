// Phase 10 — an open critical security finding caps production readiness below
// the prod-ready threshold (§K security gate), regardless of other checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootstrap, DEMO_TENANT_ID } from "@/lib/lawrence-core/bootstrap";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { getProductionReadiness } from "@/lib/mission-control/readiness/readiness-service";
import { createSecurityFinding } from "@/lib/security/security-finding-service";

test("an open critical security finding blocks prod readiness and caps the score", async () => {
  // Build a fully-configured demo tenant directly so the baseline is high and the
  // cap is meaningful (bootstrap() resets the store itself).
  await bootstrap();
  const ctx = systemActor(DEMO_TENANT_ID);

  const before = await getProductionReadiness(ctx);

  await createSecurityFinding(DEMO_TENANT_ID, {
    severity: "critical",
    findingType: "tenant_leak",
    title: "probe critical finding",
  });

  const report = await getProductionReadiness(ctx);
  assert.equal(report.prodReady, false);
  assert.ok(report.score < 85, `score was ${report.score}`);
  assert.ok(report.score < before.score, `cap did not lower score (${before.score} -> ${report.score})`);
  assert.ok(report.blockers.some((b) => b.key === "no_critical_security_findings"));
});
