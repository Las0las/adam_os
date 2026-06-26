// Phase 9 — credential service never returns absent secrets; masks refs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { getCredential, validateCredentialRef, maskCredentialRef } from "@/lib/integrations/credential-service";

test("getCredential resolves from env, null when absent", () => {
  delete process.env.TEST_CRED_X;
  assert.equal(getCredential("t", "TEST_CRED_X"), null);
  process.env.TEST_CRED_X = "secret-value";
  try {
    assert.equal(getCredential("t", "TEST_CRED_X"), "secret-value");
    assert.equal(validateCredentialRef("t", "TEST_CRED_X").present, true);
  } finally {
    delete process.env.TEST_CRED_X;
  }
  assert.equal(getCredential("t", null), null);
});

test("maskCredentialRef hides the value", () => {
  assert.equal(maskCredentialRef(null), "(none)");
  assert.match(maskCredentialRef("ANTHROPIC_API_KEY"), /…/);
});
