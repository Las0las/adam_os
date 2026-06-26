// Phase 8 — semver-lite comparison.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareVersions, isNewerVersion } from "@/lib/domain-packs/domain-pack-versioning";

test("compareVersions orders correctly", () => {
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.0", "1.1.0"), -1);
  assert.equal(compareVersions("2.0", "1.9.9"), 1);
});

test("isNewerVersion", () => {
  assert.equal(isNewerVersion("1.1.0", "1.0.0"), true);
  assert.equal(isNewerVersion("1.0.0", "1.0.0"), false);
});
