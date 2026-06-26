// Phase 10 — security self-test harness. A deterministic, non-mutating suite of
// probes that exercise the security primitives (access evaluation, redaction,
// detection, audit hash-chaining) and assert the controls hold. Surfaced in the
// security admin UI / API so an operator can prove controls before a review.
// Any failing probe raises a critical security finding (a broken control is a
// readiness blocker via the readiness gate).

import { evaluateObjectAccess } from "./object-policy-engine";
import { redactText } from "./redaction-service";
import { detectInText } from "./sensitive-data-detector";
import { computeEventHash } from "@/lib/lawrence-core/audit/audit-hash-service";
import { now } from "@/lib/lawrence-core/utils/ids";
import { createSecurityFinding } from "./security-finding-service";
import type { ActorContext } from "@/types/platform";
import type { SecurityContext } from "./security-types";
import type { ObjectAclEntry } from "./access-control-types";

export interface HarnessProbe {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface HarnessResult {
  generatedAt: string;
  passed: boolean;
  probeCount: number;
  failedCount: number;
  probes: HarnessProbe[];
}

function emptyCtx(tenantId: string, permissions: SecurityContext["permissions"]): SecurityContext {
  return { tenantId, userId: "probe", roleKeys: [], groupIds: [], permissions };
}

function probe(key: string, label: string, passed: boolean, detail: string): HarnessProbe {
  return { key, label, passed, detail };
}

/** Run the security control probes. Pure/deterministic — no store mutation. */
export async function runSecurityHarness(ctx: ActorContext): Promise<HarnessResult> {
  const t = ctx.tenantId;
  const probes: HarnessProbe[] = [];

  // 1. Default deny — no ACL, no policy, no role permission → denied.
  {
    const d = evaluateObjectAccess({
      securityContext: emptyCtx(t, []),
      objectTenantId: t,
      objectType: "Document",
      objectId: "doc_probe",
      permission: "read",
      acls: [],
      policies: [],
    });
    probes.push(probe("default_deny", "Unprivileged access is denied by default", !d.allowed, d.reason));
  }

  // 2. Tenant mismatch is always denied, even with a matching allow ACL.
  {
    const allowAcl: ObjectAclEntry = {
      id: "acl_probe",
      tenantId: t,
      objectType: "Document",
      objectId: "doc_probe",
      principalType: "user",
      principalId: "probe",
      permission: "read",
      effect: "allow",
      createdAt: "1970-01-01T00:00:00.000Z",
    };
    const d = evaluateObjectAccess({
      securityContext: emptyCtx(t, []),
      objectTenantId: "tenant_other",
      objectType: "Document",
      objectId: "doc_probe",
      permission: "read",
      acls: [allowAcl],
      policies: [],
    });
    probes.push(probe("tenant_isolation", "Cross-tenant object access is denied", !d.allowed, d.reason));
  }

  // 3. Deny ACL overrides an allow ACL (deny-override ordering).
  {
    const acls: ObjectAclEntry[] = [
      { id: "a1", tenantId: t, objectType: "Document", objectId: "d", principalType: "user", principalId: "probe", permission: "read", effect: "allow", createdAt: "1970-01-01T00:00:00.000Z" },
      { id: "a2", tenantId: t, objectType: "Document", objectId: "d", principalType: "user", principalId: "probe", permission: "read", effect: "deny", createdAt: "1970-01-01T00:00:00.000Z" },
    ];
    const d = evaluateObjectAccess({
      securityContext: emptyCtx(t, []),
      objectTenantId: t,
      objectType: "Document",
      objectId: "d",
      permission: "read",
      acls,
      policies: [],
    });
    probes.push(probe("deny_override", "Explicit deny overrides allow", !d.allowed, d.reason));
  }

  // 4. Role permission grants access where appropriate.
  {
    const d = evaluateObjectAccess({
      securityContext: emptyCtx(t, ["security.admin"]),
      objectTenantId: t,
      objectType: "Document",
      objectId: "d",
      permission: "read",
      acls: [],
      policies: [],
    });
    probes.push(probe("role_permission", "Authorized role is granted access", d.allowed, d.reason));
  }

  // 5. Redaction removes a planted secret from free text.
  {
    const planted = "key sk-ant-abcdefghijklmnopqrstuvwxyz0123 here";
    const { text, redactionCount } = redactText(planted);
    const clean = !text.includes("sk-ant-abcdefghijklmnopqrstuvwxyz0123") && redactionCount > 0;
    probes.push(probe("redaction", "Secrets are redacted from text", clean, `${redactionCount} redactions`));
  }

  // 6. Detector flags a planted credential as credential-class.
  {
    const hits = detectInText("AKIAIOSFODNN7EXAMPLE");
    const found = hits.some((h) => h.classification === "credential");
    const leaks = hits.some((h) => h.maskedSample.includes("AKIAIOSFODNN7EXAMPLE"));
    probes.push(probe("secret_detection", "Credentials are detected and masked", found && !leaks, `${hits.length} hits`));
  }

  // 7. Audit hash-chaining is deterministic and links to the previous hash.
  {
    const ev = {
      id: "ae_probe",
      tenantId: t,
      action: "probe.event",
      subjectType: "probe",
      subjectId: "p1",
      actorUserId: null,
      metadata: { n: 1 },
      createdAt: "1970-01-01T00:00:00.000Z",
    };
    const h1 = computeEventHash(ev, null);
    const h1again = computeEventHash(ev, null);
    const h2 = computeEventHash(ev, h1);
    const ok = h1 === h1again && h2 !== h1 && h1.length === 64;
    probes.push(probe("audit_chain", "Audit hash-chaining is deterministic and linked", ok, `len ${h1.length}`));
  }

  const failed = probes.filter((p) => !p.passed);
  if (failed.length > 0) {
    await createSecurityFinding(t, {
      severity: "critical",
      findingType: "policy_gap",
      title: `Security harness failed: ${failed.map((p) => p.key).join(", ")}`,
      summary: "One or more security control probes failed — a core control is not enforcing.",
      evidence: failed.map((p) => ({ probe: p.key, detail: p.detail })),
    });
  }

  return {
    generatedAt: now(),
    passed: failed.length === 0,
    probeCount: probes.length,
    failedCount: failed.length,
    probes,
  };
}
