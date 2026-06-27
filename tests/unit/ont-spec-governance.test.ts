// Architecture conformance for the ONT specification family. Structural (not
// semantic): every ONT-NNN spec SHALL exist and contain its required normative
// sections. ONT-002 participates alongside ONT-001.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SPEC_DIR = join(process.cwd(), "architecture", "specifications");

function ontSpecs(): Array<{ id: number; file: string; body: string }> {
  return readdirSync(SPEC_DIR)
    .filter((f) => /^ONT-\d+.*\.md$/.test(f))
    .map((f) => {
      const m = /^ONT-(\d+)/.exec(f)!;
      return { id: Number(m[1]), file: f, body: readFileSync(join(SPEC_DIR, f), "utf8") };
    });
}

test("ONT-001 and ONT-002 specifications both exist", () => {
  const ids = ontSpecs().map((s) => s.id);
  assert.ok(ids.includes(1), "ONT-001 present");
  assert.ok(ids.includes(2), "ONT-002 present");
});

test("every ONT specification declares the required normative sections", () => {
  const required = ["## Purpose", "## Conformance", "## Derived From"];
  const offenders: string[] = [];
  for (const spec of ontSpecs()) {
    for (const section of required) {
      if (!spec.body.includes(section)) offenders.push(`${spec.file}: missing "${section}"`);
    }
  }
  assert.deepEqual(offenders, [], `non-conformant ONT specs:\n${offenders.join("\n")}`);
});

test("ONT-002 declares relationship contract essentials", () => {
  const ont002 = ontSpecs().find((s) => s.id === 2);
  assert.ok(ont002, "ONT-002 present");
  for (const token of ["Cardinality", "Directionality", "Relationship identity", "Relationship lifecycle", "Validation rules"]) {
    assert.ok(ont002!.body.includes(token), `ONT-002 covers "${token}"`);
  }
});
