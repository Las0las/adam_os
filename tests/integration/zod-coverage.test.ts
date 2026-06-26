// Broader zod coverage: newly-validated routes reject malformed bodies with 400
// before any service runs (validation happens inside run() via parseBody).
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST as runStep } from "../../app/api/demos/[packKey]/[demoKey]/run-step/route";
import { POST as createGroup } from "../../app/api/security/groups/route";
import { POST as runRetention } from "../../app/api/security/retention/run/route";

function emptyPost(): Request {
  return new Request("http://x", {
    method: "POST",
    body: JSON.stringify({}),
    headers: { "content-type": "application/json" },
  });
}

async function assert400(res: Response): Promise<void> {
  assert.equal(res.status, 400);
  const json = (await res.json()) as { ok: boolean; error: string };
  assert.equal(json.ok, false);
  assert.match(json.error, /invalid request body/);
}

test("demos run-step rejects a body missing stepKey", async () => {
  await assert400(await runStep(emptyPost(), { params: { packKey: "p", demoKey: "d" } }));
});

test("security groups rejects a body missing key/name", async () => {
  await assert400(await createGroup(emptyPost()));
});

test("security retention run rejects a body missing policyId", async () => {
  await assert400(await runRetention(emptyPost()));
});
