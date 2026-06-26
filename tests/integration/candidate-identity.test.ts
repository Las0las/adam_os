// Cross-source candidate identity resolution + governed merge. Synthetic data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject, linkObjects, linksFor } from "@/lib/dataops/ontology/object-service";
import {
  findDuplicateCandidates,
  scanDuplicateClusters,
  mergeCandidates,
} from "@/lib/domains/recruiting/candidate-identity-service";
import { POST as mergeRoute } from "../../app/api/recruiting/candidates/merge/route";
import type { ActorContext } from "@/types/platform";

function seed(ctx: ActorContext, externalKey: string, props: Record<string, unknown>) {
  return upsertObject(ctx, {
    objectType: "Candidate",
    externalKey,
    title: (props.fullName as string) ?? externalKey,
    status: "new",
    properties: props,
  });
}

test("findDuplicateCandidates matches on email, profile URL, and name+phone", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_id");
  const a = await seed(ctx, "k1", {
    fullName: "Dana Diaz",
    email: "dana@example.test",
    profileUrl: "https://linkedin.test/dana",
    phone: "+1-555-0100",
  });

  const byEmail = await findDuplicateCandidates(ctx, { email: "DANA@example.test" });
  assert.equal(byEmail[0]?.candidate.id, a.id);
  assert.equal(byEmail[0]?.strength, "strong");

  const byUrl = await findDuplicateCandidates(ctx, { profileUrl: "linkedin.test/dana/" });
  assert.equal(byUrl[0]?.strength, "strong");

  const byNamePhone = await findDuplicateCandidates(ctx, { fullName: "dana diaz", phone: "5550100" });
  assert.equal(byNamePhone[0]?.strength, "medium");

  const byNameOnly = await findDuplicateCandidates(ctx, { fullName: "Dana Diaz" });
  assert.equal(byNameOnly[0]?.strength, "weak");

  // Excludes self.
  const exclSelf = await findDuplicateCandidates(ctx, { id: a.id, email: "dana@example.test" });
  assert.equal(exclSelf.length, 0);
});

test("scanDuplicateClusters surfaces strong/medium pairs but not name-only", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_id");
  // Same person, two source keys sharing an email -> strong cluster.
  await seed(ctx, "linkedin:1", { fullName: "Dana Diaz", email: "dana@example.test" });
  await seed(ctx, "greenhouse:1", { fullName: "Dana D", email: "dana@example.test" });
  // A mere name twin with no corroborating signal -> not a cluster.
  await seed(ctx, "other:1", { fullName: "Dana Diaz", email: "different@example.test" });

  const clusters = await scanDuplicateClusters(ctx);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0]?.strength, "strong");
});

test("mergeCandidates re-points edges, backfills, aliases, and tombstones the duplicate", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_id");
  const survivor = await seed(ctx, "s@example.test", { fullName: "Dana Diaz", email: "s@example.test" });
  const duplicate = await seed(ctx, "d@example.test", {
    fullName: "Dana Diaz",
    email: "d@example.test",
    phone: "+1-555-0100",
    location: "NYC",
  });
  // A submission linked to the duplicate.
  const submission = await upsertObject(ctx, {
    objectType: "Submission",
    externalKey: "sub-1",
    title: "App",
    status: "new",
    properties: {},
  });
  await linkObjects(ctx, {
    linkType: "submitted",
    from: { objectType: "Candidate", objectId: duplicate.id },
    to: { objectType: "Submission", objectId: submission.id },
  });

  const merged = await mergeCandidates(ctx, { survivorId: survivor.id, duplicateId: duplicate.id });

  // Backfilled missing fields from the duplicate.
  assert.equal(merged.properties.phone, "+1-555-0100");
  assert.equal(merged.properties.location, "NYC");
  // Alias records the duplicate's key.
  assert.ok((merged.properties.aliases as string[]).includes("d@example.test"));

  // Edge now points at the survivor, not the duplicate.
  const survivorLinks = await linksFor(ctx, survivor.id);
  assert.ok(survivorLinks.some((l) => l.linkType === "submitted" && l.fromObjectId === survivor.id));
  const dupLinks = await linksFor(ctx, duplicate.id);
  assert.equal(dupLinks.length, 0);

  // Duplicate is tombstoned with a pointer to the survivor.
  const tomb = await db.ontologyObjects.get(ctx.tenantId, duplicate.id);
  assert.equal(tomb?.status, "merged");
  assert.equal(tomb?.properties.mergedInto, survivor.id);

  // Tombstones are excluded from future detection.
  assert.equal((await findDuplicateCandidates(ctx, { email: "d@example.test" })).length, 0);
});

test("merge is idempotent and permission-gated", async () => {
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_id");
  const s = await seed(ctx, "s@x.test", { fullName: "A", email: "s@x.test" });
  const d = await seed(ctx, "d@x.test", { fullName: "A", email: "d@x.test" });

  const noPerms: ActorContext = { tenantId: "tnt_id", actorUserId: null, permissions: [] };
  await assert.rejects(() => mergeCandidates(noPerms, { survivorId: s.id, duplicateId: d.id }), /permission/i);

  await mergeCandidates(ctx, { survivorId: s.id, duplicateId: d.id });
  // Re-merging an already-merged duplicate is a no-op (no throw).
  const again = await mergeCandidates(ctx, { survivorId: s.id, duplicateId: d.id });
  assert.equal(again.id, s.id);
});

test("the merge route rejects a body missing ids with 400", async () => {
  const res = await mergeRoute(
    new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ survivorId: "only-one" }),
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(res.status, 400);
  const json = (await res.json()) as { ok: boolean; error: string };
  assert.equal(json.ok, false);
  assert.match(json.error, /invalid request body/);
});
