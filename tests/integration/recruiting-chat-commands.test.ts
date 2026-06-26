// Conversational update path (slice B). NL command -> governed action / draft.
// A schema-aware stub model returns intent JSON for the classifier and candidate
// JSON for extraction. Synthetic data only; no direct mutation bypasses governance.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resetDatabase, db } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject, listObjects } from "@/lib/dataops/ontology/object-service";
import { runRecruitingChatCommand } from "@/lib/domains/recruiting/recruiting-chat-service";
import { setModelProvider, MockModelProvider, type ModelProvider } from "@/lib/aiops/models/model-provider";
import { POST as chatRoute } from "../../app/api/recruiting/chat/route";
import type { ActorContext } from "@/types/platform";

// Returns intent JSON when asked for an "intent" schema, candidate JSON otherwise.
function stub(intentJson: Record<string, unknown>, candidateJson: Record<string, unknown> = {}): ModelProvider {
  return {
    provider: "stub",
    modelKey: "stub-1",
    async complete(req) {
      const props = (req.outputSchema?.properties ?? {}) as Record<string, unknown>;
      const json = "intent" in props ? intentJson : candidateJson;
      return {
        text: JSON.stringify(json),
        json,
        promptTokens: 1,
        completionTokens: 1,
        latencyMs: 1,
        costUsd: 0,
        provider: "stub",
        modelKey: "stub-1",
      };
    },
  };
}

async function seedCandidate(ctx: ActorContext, fullName: string, email: string) {
  return upsertObject(ctx, {
    objectType: "Candidate",
    externalKey: email,
    title: fullName,
    status: "new",
    properties: { fullName, email },
  });
}

test('"move Dana to interview" routes through the approval-gated action', async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub({ intent: "advance_stage", candidate: "Dana", toStage: "interview" }));
  try {
    const ctx = systemActor("tnt_chat");
    const dana = await seedCandidate(ctx, "Dana Diaz", "dana@example.test");

    const res = await runRecruitingChatCommand(ctx, { message: "move Dana to interview" });
    assert.equal(res.intent, "advance_stage");
    assert.equal(res.status, "pending_approval");
    assert.ok(res.reviewCaseId, "an approval review case was opened");

    // Governance held: the stage change is NOT applied until approved.
    const after = await db.ontologyObjects.get(ctx.tenantId, dana.id);
    assert.equal(after?.status, "new");
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test('"note on Dana" executes the non-gated note action', async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub({ intent: "add_note", candidate: "Dana", note: "Strong backend signal." }));
  try {
    const ctx = systemActor("tnt_chat");
    await seedCandidate(ctx, "Dana Diaz", "dana@example.test");

    const res = await runRecruitingChatCommand(ctx, { message: "note on Dana: strong backend signal." });
    assert.equal(res.status, "executed");
    assert.equal((await listObjects(ctx, "RecruiterNote")).length, 1);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("pasting a profile creates a draft (slice A path), not a Candidate", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(
    stub(
      { intent: "create_candidate" },
      { fullName: "Nina Park", email: "nina@example.test", headline: "PM", currentTitle: "PM" },
    ),
  );
  try {
    const ctx = systemActor("tnt_chat");
    const res = await runRecruitingChatCommand(ctx, {
      message: "Nina Park — PM at Acme — nina@example.test",
    });
    assert.equal(res.intent, "create_candidate");
    assert.equal(res.status, "draft");
    assert.ok(res.reviewCaseId);
    // No authoritative Candidate yet (only a CandidateExtraction staging object).
    assert.equal((await listObjects(ctx, "Candidate")).length, 0);
    assert.equal((await listObjects(ctx, "CandidateExtraction")).length, 1);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("an unresolved candidate asks to clarify and mutates nothing", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub({ intent: "advance_stage", candidate: "Nobody", toStage: "interview" }));
  try {
    const ctx = systemActor("tnt_chat");
    await seedCandidate(ctx, "Dana Diaz", "dana@example.test");
    const res = await runRecruitingChatCommand(ctx, { message: "move Nobody to interview" });
    assert.equal(res.status, "needs_clarification");
    assert.equal((await db.actionExecutions.list(ctx.tenantId)).length, 0);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("an ambiguous reference asks to clarify", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub({ intent: "advance_stage", candidate: "Sam", toStage: "offer" }));
  try {
    const ctx = systemActor("tnt_chat");
    await seedCandidate(ctx, "Sam Roe", "sam.roe@example.test");
    await seedCandidate(ctx, "Sammy Lee", "sammy@example.test");
    const res = await runRecruitingChatCommand(ctx, { message: "advance Sam to offer" });
    assert.equal(res.status, "needs_clarification");
    assert.match(res.message, /Multiple candidates/);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("missing the review.reviewer permission blocks the stage change (governed)", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub({ intent: "advance_stage", candidate: "Dana", toStage: "interview" }));
  try {
    const admin = systemActor("tnt_chat");
    await seedCandidate(admin, "Dana Diaz", "dana@example.test");
    const writerOnly: ActorContext = {
      tenantId: "tnt_chat",
      actorUserId: null,
      permissions: ["ontology.admin"], // no review.reviewer
    };
    const res = await runRecruitingChatCommand(writerOnly, { message: "move Dana to interview" });
    assert.equal(res.status, "blocked");
    assert.match(res.message, /permission/i);
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("an unrecognized command is reported as unsupported", async () => {
  await resetDatabase();
  resetClock();
  setModelProvider(stub({ intent: "unknown" }));
  try {
    const ctx = systemActor("tnt_chat");
    const res = await runRecruitingChatCommand(ctx, { message: "what's the weather" });
    assert.equal(res.status, "unsupported");
  } finally {
    setModelProvider(new MockModelProvider());
  }
});

test("the chat route rejects a body missing message with 400", async () => {
  const res = await chatRoute(
    new Request("http://x", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(res.status, 400);
  const json = (await res.json()) as { ok: boolean; error: string };
  assert.equal(json.ok, false);
  assert.match(json.error, /invalid request body/);
});
