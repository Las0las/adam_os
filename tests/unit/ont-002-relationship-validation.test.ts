// ONT-002 validation + warn-only integration. Pure validation covers every
// violation class; the linkObjects integration proves warn-only/fail-open/
// passthrough behavior and a zero relationship-warning baseline across all packs.
// In-memory DB backend.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { linkObjects } from "@/lib/dataops/ontology/object-service";
import {
  validateRelationship,
  validateRelationshipShape,
  cardinalityViolations,
} from "@/lib/dataops/ontology/relationships/validate";
import { findRelationship } from "@/lib/dataops/ontology/relationships/registry";
import { listDomainPackManifests } from "@/lib/domain-packs/domain-pack-registry";
import { installDomainPack } from "@/lib/domain-packs/domain-pack-installer";
import { runDemo } from "@/lib/demo/demo-runner";
import "@/lib/domain-packs/packs";
import "@/lib/domains/recruiting/recruiting-actions";

const codes = (vs: { code: string }[]) => vs.map((v) => v.code);

// ── Pure validation ─────────────────────────────────────────────────────────

test("valid relationships produce no violations", () => {
  assert.deepEqual(validateRelationshipShape({ linkType: "submitted", sourceType: "Candidate", targetType: "Submission" }), []);
  assert.deepEqual(validateRelationshipShape({ linkType: "targets", sourceType: "Submission", targetType: "Job" }), []);
  assert.deepEqual(validateRelationshipShape({ linkType: "for", sourceType: "Job", targetType: "Account" }), []);
});

test("unknown relationship type warns", () => {
  const v = validateRelationshipShape({ linkType: "bogus_rel", sourceType: "Candidate", targetType: "Submission" });
  assert.deepEqual(codes(v), ["unknown_relationship_type"]);
});

test("invalid source warns", () => {
  // `targets` is Submission -> Job; Candidate is not a valid source.
  const v = validateRelationshipShape({ linkType: "targets", sourceType: "Candidate", targetType: "Job" });
  assert.deepEqual(codes(v), ["invalid_source"]);
});

test("invalid target warns", () => {
  const v = validateRelationshipShape({ linkType: "targets", sourceType: "Submission", targetType: "Candidate" });
  assert.deepEqual(codes(v), ["invalid_target"]);
});

test("invalid direction warns", () => {
  // Reversed: defined as Submission -> Job, attempted Job -> Submission.
  const v = validateRelationshipShape({ linkType: "targets", sourceType: "Job", targetType: "Submission" });
  assert.deepEqual(codes(v), ["invalid_direction"]);
});

test("cardinality violations are detected", () => {
  const manyToOne = findRelationship("targets", "Submission", "Job")!;
  assert.deepEqual(codes(cardinalityViolations(manyToOne, { sourceOutDegree: 1, targetInDegree: 0 })), ["cardinality"]);
  assert.deepEqual(cardinalityViolations(manyToOne, { sourceOutDegree: 0, targetInDegree: 5 }), []); // target side unbounded

  const oneToMany = findRelationship("submitted", "Candidate", "Submission")!;
  assert.deepEqual(codes(cardinalityViolations(oneToMany, { sourceOutDegree: 9, targetInDegree: 0 })), []); // source side unbounded
  assert.deepEqual(codes(cardinalityViolations(oneToMany, { sourceOutDegree: 0, targetInDegree: 1 })), ["cardinality"]);
});

test("unknown object types pass through validation (no throw, warn only)", () => {
  // A wholly unknown linkType between unknown types → unknown_relationship_type, never throws.
  const v = validateRelationship({ linkType: "mystery", sourceType: "Foo", targetType: "Bar" });
  assert.deepEqual(codes(v), ["unknown_relationship_type"]);
});

// ── Warn-only integration via linkObjects ───────────────────────────────────

async function relWarnings(tenantId: string) {
  return await db.ontologyLinks.list(tenantId, () => true).then(async () =>
    (await db.auditEvents.list(tenantId, (e) => e.action === "ontology.relationship.warning")),
  );
}

beforeEach(async () => {
  await resetDatabase();
  resetClock();
});

test("a valid edge persists with no relationship warning", async () => {
  const ctx = systemActor("tnt_rel_ok");
  const link = await linkObjects(ctx, {
    linkType: "submitted",
    from: { objectType: "Candidate", objectId: "c1" },
    to: { objectType: "Submission", objectId: "s1" },
  });
  assert.ok(link.id);
  assert.equal((await relWarnings(ctx.tenantId)).length, 0);
});

test("an unknown/illegal edge still persists (passthrough) but warns", async () => {
  const ctx = systemActor("tnt_rel_bad");
  // Unknown relationship type — warn-only, must still persist.
  const link = await linkObjects(ctx, {
    linkType: "totally_unknown",
    from: { objectType: "Candidate", objectId: "c1" },
    to: { objectType: "Account", objectId: "a1" },
  });
  assert.ok(link.id, "edge persisted despite unknown type");
  const warnings = await relWarnings(ctx.tenantId);
  assert.equal(warnings.length, 1);
  const meta = warnings[0]!.metadata as { violations: { code: string }[] };
  assert.deepEqual(codes(meta.violations), ["unknown_relationship_type"]);
});

test("cardinality violation warns but still persists (many_to_one)", async () => {
  const ctx = systemActor("tnt_rel_card");
  // First targets edge is clean.
  await linkObjects(ctx, { linkType: "targets", from: { objectType: "Submission", objectId: "sub1" }, to: { objectType: "Job", objectId: "jobA" } });
  assert.equal((await relWarnings(ctx.tenantId)).length, 0);
  // Second targets edge from the SAME submission to a different job → many_to_one breach.
  const link2 = await linkObjects(ctx, { linkType: "targets", from: { objectType: "Submission", objectId: "sub1" }, to: { objectType: "Job", objectId: "jobB" } });
  assert.ok(link2.id, "edge still persisted");
  const warnings = await relWarnings(ctx.tenantId);
  assert.equal(warnings.length, 1);
  assert.deepEqual(codes((warnings[0]!.metadata as { violations: { code: string }[] }).violations), ["cardinality"]);
});

test("re-linking the same edge is idempotent and does not warn", async () => {
  const ctx = systemActor("tnt_rel_idem");
  const a = await linkObjects(ctx, { linkType: "submitted", from: { objectType: "Candidate", objectId: "c1" }, to: { objectType: "Submission", objectId: "s1" } });
  const b = await linkObjects(ctx, { linkType: "submitted", from: { objectType: "Candidate", objectId: "c1" }, to: { objectType: "Submission", objectId: "s1" } });
  assert.equal(a.id, b.id);
  assert.equal((await relWarnings(ctx.tenantId)).length, 0);
});

test("zero relationship-warning baseline across all pack installs + demos", async () => {
  const offenders: string[] = [];
  for (const manifest of listDomainPackManifests()) {
    const ctx = systemActor(`tnt_${manifest.key}`);
    await installDomainPack(ctx, manifest);
    for (const demo of manifest.demoScenarios ?? []) {
      await runDemo(ctx, manifest.key, demo.key);
    }
    const warnings = await db.auditEvents.list(ctx.tenantId, (e) => e.action === "ontology.relationship.warning");
    for (const w of warnings) {
      const m = w.metadata as { linkType: string; sourceType: string; targetType: string; violations: { code: string }[] };
      offenders.push(`${manifest.key} ${m.sourceType}-${m.linkType}->${m.targetType} [${m.violations.map((v) => v.code).join(",")}]`);
    }
  }
  assert.deepEqual(offenders, [], `expected zero relationship warnings, found:\n${offenders.join("\n")}`);
});
