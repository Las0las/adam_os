// Builtin action: the governed handler the Candidate.CreateRequested domain
// intent resolves to. The Universal Projection Runtime emits the intent; this
// handler is where it lands in the governance pipeline. It re-validates the
// payload server-side via the SAME declarative metadata the UI used (defense in
// depth — the UI's validation is convenience, this is authoritative), then
// persists through the governed `upsertObject` (which itself enforces permission,
// canonical schema, and audit). The handler never trusts the client's shaping.

import { registerAction } from "@/lib/mission-control/actions/action-service";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { Kernel, appendLedger } from "@/lib/kernel";
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
    // L0 — obtain an ExecutionAuthority from the kernel BEFORE any mutation.
    // The kernel asks the Constitution Runtime to authorize this intent, records
    // the grant to the Execution Ledger, and returns a signed, expiring token —
    // or throws AuthorityDeniedError, which the action engine surfaces as a
    // denial. This is the authoritative, fail-closed re-check; the handler never
    // mutates without a granted token.
    const actorUserId = ctx.actorUserId ?? null;
    const authority = Kernel.assertAuthority({
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

    // Authoritatively shape the canonical object from the metadata bindings —
    // never trust a client-assembled title/status/properties blob.
    const payload = toCanonicalPayload(candidateObject, input as Record<string, unknown>);
    const email = payload.properties.email;
    const externalKey =
      email != null && String(email).length > 0 ? `cand-${String(email).toLowerCase()}` : `cand-${id("c")}`;

    const candidate = await upsertObject(ctx, {
      objectType: candidateObject.objectType,
      externalKey,
      title: payload.title ?? (email != null ? String(email) : null),
      status: payload.status ?? "new",
      properties: payload.properties,
    });

    // Append the committed mutation to the append-only Execution Ledger, bound
    // to the authority that permitted it — the enterprise's operational history.
    appendLedger({
      kind: "mutation.committed",
      at: new Date().toISOString(),
      authorityId: authority.authorityId,
      decisionId: authority.decisionId,
      actorKind: authority.actor.kind,
      actorId: authority.actor.id,
      enterpriseId: authority.enterpriseId,
      summary: `Created ${candidateObject.objectType} ${candidate.id}`,
      detail: { externalKey, capabilities: authority.capabilities },
    });

    return {
      candidateId: candidate.id,
      objectType: candidateObject.objectType,
      externalKey,
      authorityId: authority.authorityId,
      decisionId: authority.decisionId,
    };
  },
});
