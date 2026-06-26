// Append-only ledgers on upsertObject: entries accumulate immutably and are
// deduped by a key field so repeated upserts within one import add one entry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";

async function ctx() {
  await resetDatabase();
  resetClock();
  return systemActor("tnt_led");
}

function ledger(runId: string, row: number) {
  return [{ prop: "imports", entry: { importRunId: runId, rowNumber: row }, dedupeKey: "importRunId" }];
}

test("ledger entry is created on first upsert", async () => {
  const c = await ctx();
  const o = await upsertObject(c, {
    objectType: "Job",
    externalKey: "J1",
    appendLedger: ledger("imp_1", 2),
  });
  assert.deepEqual(o.properties.imports, [{ importRunId: "imp_1", rowNumber: 2 }]);
});

test("same importRunId across repeated upserts records exactly one entry", async () => {
  const c = await ctx();
  await upsertObject(c, { objectType: "Job", externalKey: "J1", appendLedger: ledger("imp_1", 2) });
  await upsertObject(c, { objectType: "Job", externalKey: "J1", appendLedger: ledger("imp_1", 7) });
  const o = await upsertObject(c, {
    objectType: "Job",
    externalKey: "J1",
    appendLedger: ledger("imp_1", 9),
  });
  assert.equal((o.properties.imports as unknown[]).length, 1, "deduped by importRunId");
});

test("a new import run appends without mutating prior entries", async () => {
  const c = await ctx();
  await upsertObject(c, { objectType: "Job", externalKey: "J1", appendLedger: ledger("imp_1", 2) });
  const o = await upsertObject(c, {
    objectType: "Job",
    externalKey: "J1",
    appendLedger: ledger("imp_2", 5),
  });
  assert.deepEqual(o.properties.imports, [
    { importRunId: "imp_1", rowNumber: 2 },
    { importRunId: "imp_2", rowNumber: 5 },
  ]);
});

test("scalar property merge does not clobber the ledger", async () => {
  const c = await ctx();
  await upsertObject(c, {
    objectType: "Job",
    externalKey: "J1",
    properties: { title: "Old" },
    appendLedger: ledger("imp_1", 2),
  });
  const o = await upsertObject(c, {
    objectType: "Job",
    externalKey: "J1",
    properties: { title: "New" }, // scalar update alongside a new ledger entry
    appendLedger: ledger("imp_2", 3),
  });
  assert.equal(o.properties.title, "New");
  assert.equal((o.properties.imports as unknown[]).length, 2);
});
