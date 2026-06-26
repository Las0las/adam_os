// Phase 10 — detectors flag sensitive patterns and return MASKED samples only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectInText, detectInObject } from "@/lib/security/sensitive-data-detector";

test("detects an AWS key as credential and masks the sample", () => {
  const hits = detectInText("AKIAIOSFODNN7EXAMPLE");
  const cred = hits.find((h) => h.classification === "credential");
  assert.ok(cred);
  assert.ok(!cred!.maskedSample.includes("AKIAIOSFODNN7EXAMPLE"));
});

test("detects email as pii", () => {
  const hits = detectInText("reach ada@example.com");
  assert.ok(hits.some((h) => h.classification === "pii"));
});

test("detectInObject reports the field path and never the raw value", () => {
  const hits = detectInObject({ note: "key sk-ant-ABCDEFGHIJKLMNOPQRSTUV", safe: "hello" });
  const hit = hits.find((h) => h.fieldPath === "note");
  assert.ok(hit);
  assert.equal(hit!.classification, "credential");
  assert.ok(!hit!.maskedSample.includes("sk-ant-ABCDEFGHIJKLMNOPQRSTUV"));
});
