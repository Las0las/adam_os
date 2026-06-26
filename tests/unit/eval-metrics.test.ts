// Phase 7 — pure eval metric functions.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hitAtK,
  reciprocalRank,
  citationCoverage,
  fieldAccuracy,
  containsAll,
  containsAny,
} from "@/lib/aiops/evals/eval-metrics";

test("hitAtK respects k", () => {
  assert.equal(hitAtK(["a", "b", "c"], ["c"], 3), 1);
  assert.equal(hitAtK(["a", "b", "c"], ["c"], 2), 0);
});

test("reciprocalRank uses first hit position", () => {
  assert.equal(reciprocalRank(["a", "b", "c"], ["b"]), 1 / 2);
  assert.equal(reciprocalRank(["a"], ["z"]), 0);
});

test("citationCoverage fraction of expected present", () => {
  assert.equal(citationCoverage(["a", "b"], ["a", "b"]), 1);
  assert.equal(citationCoverage(["a"], ["a", "b"]), 0.5);
});

test("fieldAccuracy computes exact/missing/hallucinated", () => {
  const acc = fieldAccuracy({ a: "1", b: "", c: "x" }, { a: "1", b: "2" });
  assert.equal(acc.exactMatchRate, 0.5); // a matches, b doesn't
  assert.equal(acc.missingFieldRate, 0.5); // b empty
  assert.ok(acc.hallucinatedFieldRate > 0); // c not expected
});

test("containsAll / containsAny", () => {
  assert.deepEqual(containsAll("the margin risk is high", ["margin risk", "delivery"]).missing, ["delivery"]);
  assert.deepEqual(containsAny("no issues here", ["fraud"]), []);
});
