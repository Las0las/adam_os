// VS-006 — Graph Integrity validate route. Exercises the real route handler +
// appContext (demo actor) on the in-memory backend. Read-only: returns the
// surface envelope and never throws even on an invalid graph.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemContext } from "@/lib/app/demo-context";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { POST as validateGraphRoute } from "../../app/api/ontology/graph-integrity/validate/route";

function post(body: unknown): Request {
  return new Request("http://x/api/ontology/graph-integrity/validate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(async () => {
  await resetDatabase();
  resetClock();
});

test("validate route returns a well-formed surface envelope (read-only, 200)", async () => {
  const res = await validateGraphRoute(post({}));
  assert.equal(res.status, 200);
  const json = (await res.json()) as {
    ok: boolean;
    data: { summary: { governanceState: string }; groups: unknown; report: unknown; target: unknown };
  };
  assert.equal(json.ok, true);
  assert.ok(["pass", "warning", "failed"].includes(json.data.summary.governanceState));
  assert.ok(json.data.groups && json.data.report && json.data.target);
});

test("validate route returns a failed surface (read-only, 200) for an invalid graph", async () => {
  // Seed an invalid graph into the demo tenant used by appContext.
  const ctx = await systemContext();
  await upsertObject(ctx, { objectType: "Candidate", externalKey: "c1", title: "Ada", status: "new", properties: { fullName: "Ada" } });

  const res = await validateGraphRoute(post({}));
  assert.equal(res.status, 200); // never throws on an invalid graph (warn-mode review)
  const json = (await res.json()) as { ok: boolean; data: { summary: { governanceState: string; blockingFindings: number } } };
  assert.equal(json.ok, true);
  assert.equal(json.data.summary.governanceState, "failed");
  assert.ok(json.data.summary.blockingFindings > 0);
});
