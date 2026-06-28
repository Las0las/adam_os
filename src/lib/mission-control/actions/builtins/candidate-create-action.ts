// Builtin action: the governed handler the Candidate.CreateRequested domain
// intent resolves to. The Universal Projection Runtime emits the intent; this
// handler is where it lands in the governance pipeline. It re-validates the
// payload server-side via the SAME declarative metadata the UI used (defense in
// depth — the UI's validation is convenience, this is authoritative), then
// persists through the governed `upsertObject` (which itself enforces permission,
// canonical schema, and audit). The handler never trusts the client's shaping.

import { registerAction } from "@/lib/mission-control/actions/action-service";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { Kernel, appendJournal } from "@/lib/kernel";
import { id } from "@/lib/lawrence-core/utils/ids";
import { candidateObject } from "@/lib/projection-runtime/definitions/candidate.object";
import { toCanonicalPayload } from "@/lib/projection-runtime/engines/binding-engine";
import { validateValues } from "@/lib/projection-runtime/engines/validation-engine";
import type { ResolvedField } from "@/lib/projection-runtime/contracts/universal-projection";

/** Build the resolved-field shape ValidationEngine expects directly from the
 *  object metadata (no projection needed — every editable field is in scope on
 *  the authoritative server check). */
function candidateFieldsForValidation(): ResolvedField[] {
  return candidateObject.fields.map((f) => ({
    key: f.key,
    label: f.label,
    type: f.type,
    value: undefined,
    required: (f.validations ?? []).some((r) => r.kind === "required"),
    validations: f.validations ?? [],
    visible: true,
    editable: true,
    binding: { target: f.binding.target, path: f.binding.path ?? f.key },
  }));
}

registerAction({
  key: "candidate.create",
  // Creating a canonical Candidate object is an ontology write.
  requiredPermission: "ontology.admin",
  requiresApproval: false,
  precondition(_ctx, input) {
    const result = validateValues(
      candidateFieldsForValidation(),
      candidateObject.objectValidations ?? [],
      input as Record<string, unknown>,
    );
    return result.ok ? null : (result.violations[0]?.message ?? "Invalid candidate payload");
  },
  async run(ctx, input) {
    // L0/L1 — Authority → Decision BEFORE any mutation. `Kernel.decide` first
    // asserts authority ("may this happen?", fail-closed: throws
    // AuthorityDeniedError on denial), then composes the concrete plan ("exactly
    // what will happen?") and journals it. The handler executes the plan's
    // immediate `create` step; downstream steps (assign recruiter, duplicate
    // check, AI summary, onboarding workflow) are planned for the scheduler.
    const actorUserId = ctx.actorUserId ?? null;
    const { authority, decision } = Kernel.decide({
      kind: "object.create",
      actor: {
        // The governed action engine always runs under a resolved principal:
        // a human (with a user id) or the tenant-scoped system actor.
        kind: actorUserId ? "human" : "system",
        id: actorUserId,
        tenantId: ctx.tenantId ?? null,
        permissions: ctx.permissions as unknown as string[],
      },
      enterpriseId: ctx.tenantId ?? "",
      object: { objectType: candidateObject.objectType, isMutation: false },
      audited: true,
    });
    const createStepId = decision.primaryStepId ?? "create";

    // Authoritatively shape the canonical object from the metadata bindings —
    // never trust a client-assembled title/status/properties blob.
    const payload = toCanonicalPayload(candidateObject, input as Record<string, unknown>);
    const email = payload.properties.email;
    const externalKey =
      email != null && String(email).length > 0 ? `cand-${String(email).toLowerCase()}` : `cand-${id("c")}`;

    // The runtime never edits objects in place — it PREPARES a mutation, then
    // commits it. Both steps are journaled, bound to the authorizing token.
    appendJournal({
      kind: "MutationPrepared",
      at: new Date().toISOString(),
      snapshotId: null,
      authorityId: authority.authorityId,
      decisionId: authority.decisionId,
      actorKind: authority.actor.kind,
      actorId: authority.actor.id,
      enterpriseId: authority.enterpriseId,
      summary: `Prepared create of ${candidateObject.objectType}`,
      detail: { externalKey, capabilities: authority.capabilities, decisionPlanId: decision.decisionPlanId, step: createStepId },
    });

    const candidate = await upsertObject(ctx, {
      objectType: candidateObject.objectType,
      externalKey,
      title: payload.title ?? (email != null ? String(email) : null),
      status: payload.status ?? "new",
      properties: payload.properties,
    });

    // The committed mutation creates a new object version — recorded in the
    // append-only journal, bound to the authority that permitted it.
    appendJournal({
      kind: "MutationCommitted",
      at: new Date().toISOString(),
      snapshotId: null,
      authorityId: authority.authorityId,
      decisionId: authority.decisionId,
      actorKind: authority.actor.kind,
      actorId: authority.actor.id,
      enterpriseId: authority.enterpriseId,
      summary: `Created ${candidateObject.objectType} ${candidate.id}`,
      detail: { externalKey, capabilities: authority.capabilities, decisionPlanId: decision.decisionPlanId, step: createStepId },
    });

    return {
      candidateId: candidate.id,
      objectType: candidateObject.objectType,
      externalKey,
      authorityId: authority.authorityId,
      decisionId: authority.decisionId,
      decisionPlanId: decision.decisionPlanId,
      plannedSteps: decision.steps.map((s) => s.id),
    };
  },
});
