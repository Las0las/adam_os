// End-to-end: a governed route returns the correct status from the taxonomy.
// Executing an unknown action surfaces NotFoundError (404 / not_found), not a
// redacted 500 — proving typed service errors flow through errorResponse().
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST as executeAction } from "../../app/api/mission-control/actions/[key]/execute/route";

test("executing an unknown action returns 404 not_found", async () => {
  const req = new Request("http://x/api/mission-control/actions/nope/execute", {
    method: "POST",
    body: JSON.stringify({ input: {} }),
    headers: { "content-type": "application/json" },
  });
  const res = await executeAction(req, { params: { key: "nonexistent_action_xyz" } });
  assert.equal(res.status, 404);
  const json = (await res.json()) as { ok: boolean; code: string; error: string };
  assert.equal(json.ok, false);
  assert.equal(json.code, "not_found");
  assert.match(json.error, /Unknown action/);
});
