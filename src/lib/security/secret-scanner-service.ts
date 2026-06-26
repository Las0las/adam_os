// Phase 10 — secret hygiene. Scans tenant data surfaces (ontology object
// properties, integration connection configs, model definitions) for embedded
// credentials and raises masked security findings. Never stores or logs the raw
// secret — only the detector's masked sample. Credential refs (names) are fine;
// inline secret *values* are the violation.

import { db } from "@/lib/lawrence-core/db";
import { detectInObject, type DetectorHit } from "./sensitive-data-detector";
import { createSecurityFinding } from "./security-finding-service";
import type { ActorContext } from "@/types/platform";
import type { SecurityFinding } from "./security-types";

export interface SecretScanResult {
  scanned: number;
  secretsFound: number;
  findings: SecurityFinding[];
}

function isCredential(hit: DetectorHit): boolean {
  return hit.classification === "credential";
}

/**
 * Scan a tenant's data surfaces for inline secrets. Each credential-class hit
 * becomes a high-severity `secret_exposure` finding with a MASKED evidence
 * sample. Idempotent enough for repeated runs (findings are append-only records
 * of a scan instant). Requires no caller permission — it only reads + reports.
 */
export async function scanTenantForSecrets(ctx: ActorContext): Promise<SecretScanResult> {
  const t = ctx.tenantId;
  let scanned = 0;
  const findings: SecurityFinding[] = [];

  const raise = async (
    sourceType: string,
    sourceId: string,
    hits: Array<DetectorHit & { fieldPath: string }>,
  ) => {
    for (const hit of hits.filter(isCredential)) {
      const finding = await createSecurityFinding(t, {
        severity: "high",
        findingType: "secret_exposure",
        title: `Inline secret detected in ${sourceType} field "${hit.fieldPath}"`,
        summary: `A credential-pattern value was found embedded in ${sourceType}:${sourceId}. Move it to a credential reference.`,
        objectType: sourceType,
        objectId: sourceId,
        evidence: [{ fieldPath: hit.fieldPath, maskedSample: hit.maskedSample, confidence: hit.confidence }],
      });
      findings.push(finding);
    }
  };

  // Ontology object properties.
  const objects = await db.ontologyObjects.list(t);
  for (const o of objects) {
    scanned += 1;
    await raise("ontology_object", o.id, detectInObject(o.properties as Record<string, unknown>));
  }

  // Integration connection configs (credentialRef NAMES are fine; inline values are not).
  const connections = await db.integrationConnections.list(t);
  for (const c of connections) {
    scanned += 1;
    await raise("integration_connection", c.id, detectInObject(c.config as Record<string, unknown>));
  }

  // Model definitions (api keys must be refs, never inline).
  const models = await db.modelDefinitions.list(t);
  for (const m of models) {
    scanned += 1;
    await raise("model_definition", m.id, detectInObject(m.config as Record<string, unknown>));
  }

  return { scanned, secretsFound: findings.length, findings };
}
