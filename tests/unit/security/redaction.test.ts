// Phase 10 — redaction primitives: text redaction removes secrets/PII, and each
// strategy behaves correctly and never echoes the raw value.
import { test } from "node:test";
import assert from "node:assert/strict";
import { redactText, redactValue, redactObject } from "@/lib/security/redaction-service";

test("redactText removes an Anthropic key and an email, counts redactions", () => {
  const { text, redactionCount } = redactText("ping ada@example.com with sk-ant-ABCDEFGHIJKLMNOPQRSTUV now");
  assert.ok(!text.includes("ada@example.com"));
  assert.ok(!text.includes("sk-ant-ABCDEFGHIJKLMNOPQRSTUV"));
  assert.ok(redactionCount >= 2);
});

test("redactValue strategies never echo the raw value", () => {
  assert.equal(redactValue("secret", "mask"), "********");
  assert.equal(redactValue("secret", "remove"), null);
  assert.notEqual(redactValue("secret", "hash"), "secret");
  assert.equal(redactValue("4111111111111234", "last4"), "***1234");
  assert.equal(redactValue("x", "token", "pii"), "[REDACTED:pii]");
});

test("redactObject redacts a named field only", () => {
  const out = redactObject({ email: "ada@example.com", name: "Ada" }, [{ fieldPath: "email", strategy: "mask" }]);
  assert.equal(out.email, "********");
  assert.equal(out.name, "Ada");
});
