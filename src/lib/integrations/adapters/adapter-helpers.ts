// Phase 9 — shared adapter helpers. Builds IntegrationAdapters with a uniform,
// fail-closed shape: no credential => not_configured (health) / degraded (sync),
// never fake success. When credentialed, sync ingests external records into the
// ontology via the existing DataOps services using a system actor for the
// connection's tenant.

import { systemActor } from "@/lib/lawrence-core/permissions/permissions";
import { upsertObject } from "@/lib/dataops/ontology/object-service";
import { indexEvidence } from "@/lib/dataops/evidence/chunking-service";
import type {
  IntegrationAdapter,
  IntegrationConnection,
  IntegrationHealthResult,
  IntegrationProvider,
  IntegrationSyncInput,
  IntegrationSyncResult,
  SyncedObject,
} from "../integration-types";

export function notConfigured(provider: string): IntegrationHealthResult {
  return { status: "not_configured", message: `${provider} has no credential configured` };
}

export function degradedSync(message: string): IntegrationSyncResult {
  return { status: "degraded", recordsRead: 0, recordsWritten: 0, assetsCreated: 0, mappings: [], message };
}

/** External record → ontology object descriptor a credentialed sync would map. */
export interface ExternalRecord {
  externalType: string;
  externalId: string;
  lawrenceType: string;
  title: string;
  properties: Record<string, unknown>;
  evidence?: string;
}

/**
 * Ingest external records into the ontology for the connection's tenant. Marks
 * objects with their integration provenance. Returns the object mappings.
 */
export async function ingestExternalRecords(
  connection: IntegrationConnection,
  records: ExternalRecord[],
): Promise<{ mappings: SyncedObject[]; written: number }> {
  const ctx = systemActor(connection.tenantId);
  const mappings: SyncedObject[] = [];
  for (const r of records) {
    const obj = await upsertObject(ctx, {
      objectType: r.lawrenceType,
      externalKey: `${connection.key}:${r.externalId}`,
      title: r.title,
      properties: { ...r.properties, __integration: connection.provider, __connectionKey: connection.key },
    });
    if (r.evidence) {
      await indexEvidence(ctx, { objectType: r.lawrenceType, objectId: obj.id }, r.evidence, {
        documentTitle: r.title,
      });
    }
    mappings.push({
      externalObjectType: r.externalType,
      externalObjectId: r.externalId,
      lawrenceObjectType: r.lawrenceType,
      lawrenceObjectId: obj.id,
    });
  }
  return { mappings, written: mappings.length };
}

export interface AdapterSpec {
  provider: IntegrationProvider;
  capabilities: string[];
  /** Real health probe when a credential is present (e.g. a /me call). */
  probe?: (connection: IntegrationConnection, credential: string) => Promise<IntegrationHealthResult>;
  /** Fetch + map external records when credentialed. */
  fetchRecords?: (
    connection: IntegrationConnection,
    input: IntegrationSyncInput & { credential: string },
  ) => Promise<ExternalRecord[]>;
  handleWebhook?: IntegrationAdapter["handleWebhook"];
}

export function makeAdapter(spec: AdapterSpec): IntegrationAdapter {
  return {
    provider: spec.provider,
    capabilities: spec.capabilities,
    async testConnection(connection, credential) {
      if (!credential) return notConfigured(spec.provider);
      if (spec.probe) {
        try {
          return await spec.probe(connection, credential);
        } catch (err) {
          return { status: "degraded", message: err instanceof Error ? err.message : String(err) };
        }
      }
      return { status: "active", message: `${spec.provider} credential present` };
    },
    async sync(connection, input) {
      if (!input.credential) return degradedSync(`${spec.provider} not configured — skipping sync`);
      if (!spec.fetchRecords) return degradedSync(`${spec.provider} sync not implemented`);
      const records = await spec.fetchRecords(connection, { ...input, credential: input.credential });
      const { mappings, written } = await ingestExternalRecords(connection, records);
      return {
        status: "completed",
        recordsRead: records.length,
        recordsWritten: written,
        assetsCreated: 0,
        mappings,
      };
    },
    handleWebhook: spec.handleWebhook,
  };
}
