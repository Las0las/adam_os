// parseBody: typed validation for request bodies (the shared API-hardening seam).
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { parseBody, ValidationError } from "@/lib/app/route-helpers";

function jsonReq(body: unknown): Request {
  return new Request("http://x", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

test("parseBody returns typed, validated data", async () => {
  const schema = z.object({ a: z.string(), n: z.number().optional() });
  const data = await parseBody(jsonReq({ a: "hi", n: 2 }), schema);
  assert.equal(data.a, "hi");
  assert.equal(data.n, 2);
});

test("parseBody throws ValidationError naming the offending field", async () => {
  const schema = z.object({ reason: z.string().min(1) });
  await assert.rejects(
    () => parseBody(jsonReq({}), schema),
    (err: unknown) => err instanceof ValidationError && /reason/.test(err.message),
  );
});

test("parseBody rejects a non-JSON / empty body", async () => {
  const schema = z.object({ a: z.string() });
  const bad = new Request("http://x", { method: "POST", body: "not-json" });
  await assert.rejects(() => parseBody(bad, schema), ValidationError);
});

test("parseBody strips unknown keys it does not declare", async () => {
  const schema = z.object({ a: z.string() });
  const data = (await parseBody(jsonReq({ a: "x", extra: "drop" }), schema)) as Record<string, unknown>;
  assert.equal(data.a, "x");
  assert.equal("extra" in data, false);
});
