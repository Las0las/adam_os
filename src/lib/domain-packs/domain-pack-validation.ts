// Phase 8 — manifest validation. Fail-closed: an installer must validate before
// touching tenant data.

import type { DomainPackManifest } from "./domain-pack-types";

export interface PackValidationResult {
  valid: boolean;
  errors: string[];
}

const SEMVER = /^\d+\.\d+(\.\d+)?$/;

export function validateManifest(manifest: DomainPackManifest): PackValidationResult {
  const errors: string[] = [];
  if (!manifest.key) errors.push("manifest.key is required");
  if (!manifest.name) errors.push("manifest.name is required");
  if (!manifest.version || !SEMVER.test(manifest.version)) {
    errors.push(`manifest.version must be semver-like (got '${manifest.version}')`);
  }
  if (!manifest.category) errors.push("manifest.category is required");
  if (manifest.objectTypes.length === 0) errors.push("manifest must declare at least one objectType");
  if (!manifest.seedPackKey && manifest.sampleObjects.length === 0) {
    errors.push("manifest must reference a seedPackKey or provide sampleObjects");
  }
  for (const suite of manifest.evalSuites) {
    if (!suite.key || !suite.targetComponentKey) {
      errors.push(`eval suite '${suite.key}' must have a key and targetComponentKey`);
    }
  }
  for (const demo of manifest.demoScenarios) {
    if (demo.steps.length === 0) errors.push(`demo '${demo.key}' has no steps`);
  }
  return { valid: errors.length === 0, errors };
}
