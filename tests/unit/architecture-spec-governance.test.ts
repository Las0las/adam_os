// Specification governance — the Canonical Object Contract schema validator
// (Conformance Framework §6). Structural, not semantic: it verifies that every
// governed IOS specification authored from IOS-017 onward contains the required
// NORMATIVE sections. A specification that omits any is non-conformant.
//
// No retroactive rule for IOS-001…IOS-016 (the contract was adopted at IOS-017).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SPEC_DIR = join(process.cwd(), "architecture", "specifications");

/** The rule applies to specifications authored from this identifier onward. */
const CONTRACT_REQUIRED_FROM = 17;

/** Required Canonical Object Contract field labels (normative). */
const REQUIRED_FIELDS = [
  "Canonical Objects Consumed",
  "Canonical Objects Produced",
  "Existing Contracts Reused",
  "Authoritative Producers",
  "Authorized Consumers",
];

function iosSpecs(): Array<{ id: number; file: string; body: string }> {
  return readdirSync(SPEC_DIR)
    .filter((f) => /^IOS-\d+.*\.md$/.test(f))
    .map((f) => {
      const m = /^IOS-(\d+)/.exec(f)!;
      return { id: Number(m[1]), file: f, body: readFileSync(join(SPEC_DIR, f), "utf8") };
    });
}

test("the IOS-017+ governance rule actually has specs to validate", () => {
  const governed = iosSpecs().filter((s) => s.id >= CONTRACT_REQUIRED_FROM);
  assert.ok(governed.length >= 1, "at least one IOS-017+ specification SHALL exist to validate");
});

test("every IOS-017+ specification contains a valid Canonical Object Contract", () => {
  const offenders: string[] = [];
  for (const spec of iosSpecs()) {
    if (spec.id < CONTRACT_REQUIRED_FROM) continue; // adopted at IOS-017; not retroactive
    if (!/##\s+Canonical Object Contract/.test(spec.body)) {
      offenders.push(`${spec.file}: missing "## Canonical Object Contract" section`);
      continue;
    }
    for (const field of REQUIRED_FIELDS) {
      if (!spec.body.includes(field)) offenders.push(`${spec.file}: missing field "${field}"`);
    }
  }
  assert.deepEqual(offenders, [], `non-conformant specifications:\n${offenders.join("\n")}`);
});

test("every IOS-017+ specification declares Canonical Object Contract conformance requirements", () => {
  // The five mandatory proofs need not be verbatim, but the specification SHALL
  // reference the contract within its Conformance Requirements (structural check:
  // a Conformance Requirements section exists and mentions the contract's terms).
  const offenders: string[] = [];
  for (const spec of iosSpecs()) {
    if (spec.id < CONTRACT_REQUIRED_FROM) continue;
    if (!/##\s+Conformance Requirements/.test(spec.body)) {
      offenders.push(`${spec.file}: missing "## Conformance Requirements" section`);
      continue;
    }
    // Must speak to ownership / read-only consumption somewhere in the spec.
    const mentionsOwnership = /read-only|exclusively|owned|authority|mutat/i.test(spec.body);
    if (!mentionsOwnership) offenders.push(`${spec.file}: no Canonical Object Contract conformance language`);
  }
  assert.deepEqual(offenders, [], `specifications missing contract conformance:\n${offenders.join("\n")}`);
});
