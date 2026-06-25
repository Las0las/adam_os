import { test } from "node:test";
import assert from "node:assert/strict";
import { db, resetDatabase } from "@/lib/lawrence-core/db";
import { resetClock } from "@/lib/lawrence-core/utils/ids";
import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { listObjects, upsertObject } from "@/lib/dataops/ontology/object-service";
import { runFunction } from "@/lib/aiops/functions/function-runner";
import { executeAction } from "@/lib/mission-control/actions/action-service";
import { seedDomainPack, listDomainSeedPacks } from "@/lib/domains/domain-seed-runner";
import { supportSeedPack } from "@/lib/domains/support/support-seed-pack";
import { runTicketResponseWorkflow } from "@/lib/domains/support/support-workflow-service";
import { getSupportDashboard } from "@/lib/domains/support/support-dashboard-service";
import type { ActorContext } from "@/types/platform";

async function freshCtx(tenantId = "tnt_support"): Promise<ActorContext> {
  await resetDatabase();
  resetClock();
  const ctx = systemActor(tenantId);
  await seedDomainPack(ctx, supportSeedPack);
  return ctx;
}

async function ticketByKey(ctx: ActorContext, externalKey: string) {
  const tickets = await listObjects(ctx, "SupportTicket");
  const ticket = tickets.find((t) => t.externalKey === externalKey);
  assert.ok(ticket, `ticket ${externalKey} should be seeded`);
  return ticket;
}

test("retrieval finds KB chunks → function returns ≥1 citation for a ticket with KB", async () => {
  const ctx = await freshCtx();
  const vpn = await ticketByKey(ctx, "ticket-vpn");

  const run = await runFunction(ctx, "support.answer_with_citations", { ticketId: vpn.id });
  assert.equal(run.status, "completed");
  const output = run.output as {
    citations: unknown[];
    missingEvidence: boolean;
    draftResponse: string;
  };
  assert.ok(output.citations.length >= 1, "expected at least one citation");
  assert.equal(output.missingEvidence, false);
  assert.ok(output.draftResponse.length > 0);
});

test("function fails closed when the ticket does not exist", async () => {
  const ctx = await freshCtx();
  const run = await runFunction(ctx, "support.answer_with_citations", { ticketId: "does-not-exist" });
  assert.equal(run.status, "failed");
});

test("no knowledge-base evidence yields missingEvidence + needsReview (fail-closed answer)", async () => {
  // Fresh tenant with a ticket but NO KnowledgeDocument evidence: retrieval
  // returns zero hits, so the function falls back to the fail-closed answer.
  await resetDatabase();
  resetClock();
  const ctx = systemActor("tnt_noevidence");
  const ticket = await upsertObject(ctx, {
    objectType: "SupportTicket",
    externalKey: "ticket-orphan",
    title: "Unanswerable ticket",
    status: "open",
    properties: {},
  });

  const run = await runFunction(ctx, "support.answer_with_citations", { ticketId: ticket.id });
  assert.equal(run.status, "completed");
  const output = run.output as {
    missingEvidence: boolean;
    needsReview: boolean;
    confidence: number;
    citations: unknown[];
  };
  assert.equal(output.missingEvidence, true);
  assert.equal(output.needsReview, true);
  assert.equal(output.confidence, 0);
  assert.equal(output.citations.length, 0);
});

test("low-confidence workflow path creates a review case + queues a notification", async () => {
  const ctx = await freshCtx();
  const vpn = await ticketByKey(ctx, "ticket-vpn");

  const result = await runTicketResponseWorkflow(ctx, {
    ticketId: vpn.id,
    assigneeUserId: "agent-1",
  });

  assert.equal(result.domain, "support");
  assert.ok(result.functionRunId, "functionRunId should be set");
  assert.ok(result.reviewCaseIds.length >= 1, "low-confidence answer should open a review case");
  assert.ok(result.notificationIds.length >= 1, "a notification should be queued");

  // The review case is persisted with the expected case type.
  const cases = await db.reviewCases.list(ctx.tenantId);
  const reviewCase = cases.find((c) => c.id === result.reviewCaseIds[0]);
  assert.ok(reviewCase);
  assert.equal(reviewCase.caseType, "support.answer.needs_review");
  assert.equal(reviewCase.subjectObjectId, vpn.id);
});

test("a SupportDraftResponse object is created through the action engine", async () => {
  const ctx = await freshCtx();
  const vpn = await ticketByKey(ctx, "ticket-vpn");

  const exec = await executeAction(ctx, {
    actionKey: "support.create_draft_response",
    input: {
      ticketId: vpn.id,
      draftResponse: "Use the self-service portal to reset VPN MFA.",
      citations: [{ objectType: "KnowledgeDocument", objectId: "kb", excerpt: "x", score: 0.9 }],
      confidence: 0.9,
      assigneeUserId: "agent-1",
    },
    approvalExempt: true,
  });

  assert.equal(exec.status, "completed");
  const draftId = exec.result?.draftId as string | undefined;
  assert.ok(draftId, "action should return a draftId");

  const drafts = await listObjects(ctx, "SupportDraftResponse");
  const draft = drafts.find((d) => d.id === draftId);
  assert.ok(draft, "SupportDraftResponse object should exist");
  assert.equal(draft.properties.ticketId, vpn.id);
  assert.equal(draft.properties.confidence, 0.9);

  // High-confidence draft does NOT open a review case.
  assert.equal(exec.result?.reviewCaseId, undefined);

  // The draft is linked to its ticket.
  const links = await db.ontologyLinks.list(ctx.tenantId, (l) => l.fromObjectId === draftId);
  assert.ok(links.some((l) => l.linkType === "draft_for" && l.toObjectId === vpn.id));
});

test("low-confidence draft action opens its own review case", async () => {
  const ctx = await freshCtx();
  const vpn = await ticketByKey(ctx, "ticket-vpn");

  const exec = await executeAction(ctx, {
    actionKey: "support.create_draft_response",
    input: {
      ticketId: vpn.id,
      draftResponse: "Tentative answer.",
      citations: [],
      confidence: 0.2,
    },
    approvalExempt: true,
  });

  assert.equal(exec.status, "completed");
  assert.ok(exec.result?.reviewCaseId, "low-confidence draft should open a review case");
});

test("action precondition fails closed without a ticketId", async () => {
  const ctx = await freshCtx();
  const exec = await executeAction(ctx, {
    actionKey: "support.create_draft_response",
    input: { draftResponse: "x", confidence: 0.9 },
    approvalExempt: true,
  });
  assert.equal(exec.status, "blocked");
});

test("audit events are emitted for the function run", async () => {
  const ctx = await freshCtx();
  const vpn = await ticketByKey(ctx, "ticket-vpn");
  await runFunction(ctx, "support.answer_with_citations", { ticketId: vpn.id });

  const audits = await db.auditEvents.list(ctx.tenantId);
  assert.ok(audits.some((a) => a.action === "aiops.function.run"), "function run should be audited");
});

test("notification is queued via emitEvent on workflow completion", async () => {
  const ctx = await freshCtx();
  const vpn = await ticketByKey(ctx, "ticket-vpn");
  await runTicketResponseWorkflow(ctx, { ticketId: vpn.id, assigneeUserId: "agent-1" });

  const notifs = await db.notifications.list(ctx.tenantId);
  assert.ok(notifs.length >= 1, "expected a queued notification");
  assert.ok(notifs.every((n) => n.recipientUserId === "agent-1"));
});

test("seed is idempotent: re-seeding does not duplicate objects or rules", async () => {
  const ctx = await freshCtx();
  await seedDomainPack(ctx, supportSeedPack);
  await seedDomainPack(ctx, supportSeedPack);

  const tickets = await listObjects(ctx, "SupportTicket");
  assert.equal(tickets.length, 2, "exactly two seeded tickets");
  const docs = await listObjects(ctx, "KnowledgeDocument");
  assert.equal(docs.length, 2, "exactly two seeded knowledge docs");

  const rules = await db.notificationRules.list(ctx.tenantId);
  const draftRules = rules.filter((r) => r.eventKey === "support.draft.created");
  assert.equal(draftRules.length, 1, "draft.created rule installed once");
});

test("tenant isolation: workflow artifacts do not leak across tenants", async () => {
  const ctxA = await freshCtx("tnt_a");
  const vpnA = await ticketByKey(ctxA, "ticket-vpn");
  await runTicketResponseWorkflow(ctxA, { ticketId: vpnA.id, assigneeUserId: "agent-a" });

  // Seed a second tenant in the same database (without resetting).
  const ctxB = systemActor("tnt_b");
  await seedDomainPack(ctxB, supportSeedPack);

  const reviewsA = await db.reviewCases.list(ctxA.tenantId);
  const reviewsB = await db.reviewCases.list(ctxB.tenantId);
  assert.ok(reviewsA.length >= 1, "tenant A has its review case");
  assert.equal(reviewsB.length, 0, "tenant B sees no review cases from tenant A");

  const ticketsB = await listObjects(ctxB, "SupportTicket");
  assert.equal(ticketsB.length, 2, "tenant B has only its own seeded tickets");
});

test("seed pack is registered in the domain seed registry", async () => {
  await freshCtx();
  assert.ok(listDomainSeedPacks().some((p) => p.key === "support"));
});

test("support dashboard reports counts and the five cards", async () => {
  const ctx = await freshCtx();
  const vpn = await ticketByKey(ctx, "ticket-vpn");
  await runTicketResponseWorkflow(ctx, { ticketId: vpn.id, assigneeUserId: "agent-1" });

  const dash = await getSupportDashboard(ctx);
  assert.equal(dash.domain, "support");
  assert.equal(dash.counts.openTickets, 2);
  assert.equal(dash.counts.knowledgeDocs, 2);
  assert.ok((dash.counts.needsReview ?? 0) >= 1);
  const cardKeys = dash.cards.map((c) => c.key);
  assert.deepEqual(cardKeys, [
    "open_tickets",
    "tickets_needing_review",
    "low_confidence_drafts",
    "knowledge_gaps",
    "sla_risks",
  ]);
});
