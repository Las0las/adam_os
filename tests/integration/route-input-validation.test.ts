// End-to-end proof that a governed mutation route rejects an invalid body with a
// 400 before any service runs. Exercises the real route handler + appContext +
// parseBody on the in-memory backend (demo actor).
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST as enableKillSwitch } from "../../app/api/mission-control/kill-switches/enable/route";

function post(body: unknown): Request {
  return new Request("http://x/api/mission-control/kill-switches/enable", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

test("kill-switch enable rejects a body missing required fields with 400", async () => {
  // componentType and reason are required; only componentKey supplied.
  const res = await enableKillSwitch(post({ componentKey: "some_action" }));
  assert.equal(res.status, 400);
  const json = (await res.json()) as { ok: boolean; error: string };
  assert.equal(json.ok, false);
  assert.match(json.error, /invalid request body/);
});

test("kill-switch enable rejects a wrong-typed field with 400", async () => {
  const res = await enableKillSwitch(
    post({ componentType: 123, componentKey: "k", reason: "r" }),
  );
  assert.equal(res.status, 400);
  const json = (await res.json()) as { ok: boolean };
  assert.equal(json.ok, false);
});
