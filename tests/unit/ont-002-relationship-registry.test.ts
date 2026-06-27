// ONT-002 conformance — the canonical relationship registry is well-formed and
// covers the required seed relationships. Pure (no DB).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allRelationships,
  relationshipById,
  relationshipsByLinkType,
  findRelationship,
} from "@/lib/dataops/ontology/relationships/registry";

const CARDINALITIES = new Set(["one_to_one", "one_to_many", "many_to_one", "many_to_many"]);
const LIFECYCLES = new Set(["active", "planned", "deprecated"]);

test("every relationship definition is structurally well-formed", () => {
  const ids = new Set<string>();
  for (const d of allRelationships()) {
    assert.ok(d.id && !ids.has(d.id), `unique id: ${d.id}`);
    ids.add(d.id);
    assert.ok(d.linkType, `${d.id} has linkType`);
    assert.ok(d.sourceType, `${d.id} has sourceType`);
    assert.ok(d.targetType, `${d.id} has targetType`);
    assert.ok(CARDINALITIES.has(d.cardinality), `${d.id} cardinality valid`);
    assert.ok(LIFECYCLES.has(d.lifecycle), `${d.id} lifecycle valid`);
    assert.ok(d.description.length > 0, `${d.id} has description`);
    assert.ok(d.governance.owner && d.governance.since, `${d.id} has governance`);
    assert.ok(Array.isArray(d.emittedEvents), `${d.id} declares events`);
    assert.ok(d.permissions, `${d.id} declares permissions`);
  }
});

test("declared inverse relationships are symmetric and registered", () => {
  for (const d of allRelationships()) {
    if (!d.inverseRelationship) continue;
    const inv = relationshipById(d.inverseRelationship);
    assert.ok(inv, `${d.id} inverse ${d.inverseRelationship} is registered`);
    assert.equal(inv!.inverseRelationship, d.id, `${d.id} <-> ${inv!.id} are mutual inverses`);
    // An inverse SHALL flip the endpoints.
    assert.equal(inv!.sourceType, d.targetType);
    assert.equal(inv!.targetType, d.sourceType);
  }
});

test("required seed relationships are registered (by source -> target)", () => {
  const required: Array<[string, string]> = [
    ["Candidate", "Submission"],
    ["Submission", "Job"],
    ["Candidate", "Account"],
    ["Job", "Account"],
    ["Candidate", "Recruiter"],
    ["Submission", "Recruiter"],
    ["Submission", "Interview"],
    ["Interview", "Offer"],
    ["Offer", "Placement"],
    ["Mission", "Recommendation"],
  ];
  for (const [src, tgt] of required) {
    const found = allRelationships().some((d) => d.sourceType === src && d.targetType === tgt);
    assert.ok(found, `relationship ${src} -> ${tgt} registered`);
  }
});

test("future-safe relationships are marked planned (declared, not active)", () => {
  for (const [src, tgt] of [
    ["Submission", "Interview"],
    ["Interview", "Offer"],
    ["Offer", "Placement"],
    ["Mission", "Recommendation"],
  ] as const) {
    const def = allRelationships().find((d) => d.sourceType === src && d.targetType === tgt);
    assert.ok(def, `${src} -> ${tgt} present`);
    assert.equal(def!.lifecycle, "planned", `${src} -> ${tgt} is planned`);
  }
});

test("lookups resolve by id, linkType, and triple", () => {
  assert.ok(relationshipById("candidate_submitted_submission"));
  assert.equal(relationshipById("does_not_exist"), undefined);

  // `for` is polymorphic — multiple definitions share the linkType.
  assert.ok(relationshipsByLinkType("for").length >= 2);
  assert.equal(relationshipsByLinkType("nope").length, 0);

  assert.ok(findRelationship("submitted", "Candidate", "Submission"));
  assert.equal(findRelationship("submitted", "Job", "Candidate"), undefined);
});
