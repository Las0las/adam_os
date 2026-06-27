// ONT-001 zero warn-baseline guard. Installing every domain pack manifest and
// running every demo scenario SHALL emit zero ontology.schema.warning events.
// This locks in the clean pre-enforcement baseline: if a future producer drifts
// from a registered canonical contract (Candidate/Job/Submission/Account), this
// test fails. In-memory DB backend.
import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listDomainPackManifests } from "@/lib/domain-packs/domain-pack-registry";
import { installDomainPack } from "@/lib/domain-packs/domain-pack-installer";
import { runDemo } from "@/lib/demo/demo-runner";
import "@/lib/domain-packs/packs";
import "@/lib/domains/recruiting/recruiting-actions";

interface WarnMeta {
  objectType: string;
  externalKey: string | null;
  violations: Array<{ path: string; code: string }>;
}

test("installing every domain pack + running every demo emits zero schema warnings", async () => {
  await resetDatabase();
  resetClock();

  const manifests = listDomainPackManifests();
  assert.ok(manifests.length >= 1, "domain pack manifests registered");

  const offenders: string[] = [];
  for (const manifest of manifests) {
    const ctx = systemActor(`tnt_${manifest.key}`);
    await installDomainPack(ctx, manifest);
    for (const demo of manifest.demoScenarios ?? []) {
      await runDemo(ctx, manifest.key, demo.key);
    }
    const warnings = await db.auditEvents.list(
      ctx.tenantId,
      (e) => e.action === "ontology.schema.warning",
    );
    for (const e of warnings) {
      const meta = e.metadata as unknown as WarnMeta;
      offenders.push(
        `${manifest.key} ${meta.objectType}:${meta.externalKey ?? "—"} [${meta.violations
          .map((v) => `${v.code}@${v.path}`)
          .join(", ")}]`,
      );
    }
  }

  assert.deepEqual(offenders, [], `expected zero schema warnings, found:\n${offenders.join("\n")}`);
});
