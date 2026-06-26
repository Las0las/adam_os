// Phase 10 — security control-plane seed. Installs the demo tenant's security
// policies, scoped roles + a group, object access policies, sample data
// classifications, and retention policies so every security surface has live
// data. Idempotent (dedupe by key). Mirrors the mission-control governance seed.

import { db } from "@/lib/lawrence-core/db";
import { id, now } from "@/lib/lawrence-core/utils/ids";
import { listObjects } from "@/lib/dataops/ontology/object-service";
import { createGroup, assignRoleToGroup, addUserToGroup } from "./group-service";
import { classifyObject } from "./data-classification-service";
import { createRetentionPolicy } from "./retention-service";
import type { ActorContext, Permission } from "@/types/platform";
import type { SecurityPolicy, SecurityPolicyType } from "./security-types";
import type { ObjectAccessPolicy, ObjectPolicyRuleType } from "./access-control-types";

async function upsertSecurityPolicy(
  ctx: ActorContext,
  key: string,
  name: string,
  policyType: SecurityPolicyType,
  config: Record<string, unknown>,
): Promise<SecurityPolicy> {
  const existing = await db.securityPolicies.find(ctx.tenantId, (p) => p.key === key);
  if (existing) return existing;
  return await db.securityPolicies.insert({
    id: id("secpol"),
    tenantId: ctx.tenantId,
    key,
    name,
    policyType,
    status: "active",
    config,
    createdBy: ctx.actorUserId ?? null,
    createdAt: now(),
    updatedAt: now(),
  });
}

async function upsertObjectPolicy(
  ctx: ActorContext,
  objectType: string,
  policyKey: string,
  ruleType: ObjectPolicyRuleType,
  config: Record<string, unknown>,
): Promise<ObjectAccessPolicy> {
  const existing = await db.objectAccessPolicies.find(ctx.tenantId, (p) => p.policyKey === policyKey);
  if (existing) return existing;
  return await db.objectAccessPolicies.insert({
    id: id("opol"),
    tenantId: ctx.tenantId,
    objectType,
    policyKey,
    ruleType,
    config,
    status: "active",
    createdAt: now(),
  });
}

async function upsertRole(ctx: ActorContext, name: string, permissions: Permission[]): Promise<string> {
  const existing = await db.roles.find(ctx.tenantId, (r) => r.name === name);
  if (existing) return existing.id;
  const role = await db.roles.insert({ id: id("role"), tenantId: ctx.tenantId, name, permissions });
  return role.id;
}

export async function installSecuritySeeds(ctx: ActorContext): Promise<void> {
  // 1) Security policies — one per major control area, for the posture surface.
  await upsertSecurityPolicy(ctx, "tenant_isolation", "Tenant isolation enforced", "tenant", {
    failClosed: true,
  });
  await upsertSecurityPolicy(ctx, "rbac_default_deny", "RBAC default-deny on objects", "rbac", {
    defaultEffect: "deny",
  });
  await upsertSecurityPolicy(ctx, "classification_required", "Sensitive data must be classified", "data_classification", {
    autoDetect: true,
  });
  await upsertSecurityPolicy(ctx, "retention_default", "Default retention governance", "retention", {
    defaultAction: "review",
  });
  await upsertSecurityPolicy(ctx, "export_redaction", "Exports are redacted", "export", {
    redactFullEvidence: true,
  });
  await upsertSecurityPolicy(ctx, "ai_object_permissions", "AI retrieval honors object permissions", "ai", {
    enforceObjectRead: true,
  });
  await upsertSecurityPolicy(ctx, "audit_immutability", "Audit log is hash-chained + immutable", "audit", {
    hashChain: true,
  });

  // 2) Scoped roles + a security-officer group (RBAC demo). The analyst role is
  // read-only at the object layer; the security officer holds the security.* set.
  const analystRoleId = await upsertRole(ctx, "Analyst (read-only)", ["review.reviewer"]);
  const officerRoleId = await upsertRole(ctx, "Security Officer", [
    "security.admin",
    "security.access_manage",
    "security.classification_manage",
    "security.retention_manage",
    "security.compliance_export",
    "security.audit_verify",
    "security.finding_resolve",
  ]);
  const group = await createGroup(ctx, {
    key: "security_office",
    name: "Security Office",
    description: "Holds security-officer privileges for the demo tenant.",
  });
  await assignRoleToGroup(ctx, group.id, officerRoleId);
  await assignRoleToGroup(ctx, group.id, analystRoleId);
  await addUserToGroup(ctx, group.id, "usr_demo");

  // 3) Object access policies — redact PII on Candidate records, require approval
  // before any write to RiskSignal (governed object).
  await upsertObjectPolicy(ctx, "Candidate", "candidate_pii_redaction", "redact", { fieldPath: "email" });
  await upsertObjectPolicy(ctx, "RiskSignal", "risk_signal_write_approval", "require_approval", {});

  // 4) Sample data classifications — classify the email field of seeded
  // candidates as PII so the data map + redaction surfaces have live records.
  const candidates = (await listObjects(ctx, "Candidate")).slice(0, 3);
  for (const c of candidates) {
    await classifyObject(ctx, {
      objectType: "Candidate",
      objectId: c.id,
      fieldPath: "email",
      classification: "pii",
      source: "manual",
    });
  }

  // 5) Retention policies — risk signals archived after a year; support drafts
  // redacted after 90 days. The runner audits every affected object.
  await createRetentionPolicy(ctx, {
    key: "risk_signal_archive_365",
    name: "Archive risk signals after 1 year",
    objectType: "RiskSignal",
    retentionDays: 365,
    action: "archive",
  });
  await createRetentionPolicy(ctx, {
    key: "support_draft_redact_90",
    name: "Redact support drafts after 90 days",
    objectType: "SupportDraftResponse",
    retentionDays: 90,
    action: "redact",
  });
}
