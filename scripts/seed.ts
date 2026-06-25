// Seed / smoke script. Runs the demo bootstrap and prints a summary of what
// landed in each fabric. Usage: `npm run seed`.

import { bootstrap, DEMO_TENANT_ID } from "@/lib/lawrence-core/bootstrap";
import { db } from "@/lib/lawrence-core/db";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { retrieve } from "@/lib/aiops/retrieval/retrieval-service";
import { runFunction } from "@/lib/aiops/functions/function-runner";

async function main(): Promise<void> {
  await bootstrap();
  const ctx = systemActor(DEMO_TENANT_ID);

  const candidates = await listObjects(ctx, "Candidate");
  const retrieval = await retrieve(ctx, {
    tenantId: ctx.tenantId,
    query: "compiler systems programmer",
    methods: ["rank_fusion"],
    limit: 3,
  });
  const fnRun = await runFunction(ctx, "answer_with_citations", {
    question: "Who has cryptanalysis experience?",
    objectTypes: ["Candidate"],
  });

  console.log("LAWRENCE seed complete");
  console.log("  tenant:        ", DEMO_TENANT_ID);
  console.log("  candidates:    ", candidates.length, candidates.map((c) => c.title));
  console.log("  raw assets:    ", (await db.rawAssets.list(ctx.tenantId)).length);
  console.log("  evidence chunks:", (await db.evidenceChunks.list(ctx.tenantId)).length);
  console.log("  top retrieval: ", retrieval.hits[0]?.excerpt ?? "(none)");
  console.log("  function run:  ", fnRun.status, "citations:", fnRun.citations?.length ?? 0);
  console.log("  audit events:  ", (await db.auditEvents.list(ctx.tenantId)).length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
