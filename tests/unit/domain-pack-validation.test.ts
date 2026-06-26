// Phase 8 — manifest validation is fail-closed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "@/lib/domain-packs/domain-pack-validation";
import { getDomainPackManifest } from "@/lib/domain-packs/domain-pack-registry";
import "@/lib/domain-packs/packs";
import type { DomainPackManifest } from "@/lib/domain-packs/domain-pack-types";

test("registered packs validate", () => {
  const recruiting = getDomainPackManifest("recruiting");
  assert.ok(recruiting);
  assert.equal(validateManifest(recruiting!).valid, true);
});

test("a manifest without version or objects is invalid", () => {
  const bad = {
    key: "x",
    name: "X",
    version: "not-semver",
    category: "generic",
    description: "",
    objectTypes: [],
    linkTypes: [],
    functions: [],
    agents: [],
    actions: [],
    notificationRules: [],
    evalSuites: [],
    demoScenarios: [],
    sampleObjects: [],
    businessValue: "",
    implementationRoadmap: [],
    requiredIntegrations: [],
    dataRequired: [],
    governanceControls: [],
    successMetrics: [],
  } as DomainPackManifest;
  const result = validateManifest(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /version/.test(e)));
  assert.ok(result.errors.some((e) => /objectType/.test(e)));
});
