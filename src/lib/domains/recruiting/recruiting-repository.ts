// Example Postgres repository (Phase 2 §45). Demonstrates the production read
// path: thin, tenant-scoped SQL behind a typed service. Active only when
// DATABASE_URL is configured; the in-memory ontology store backs local/test.

import { query } from "@/lib/lawrence-core/db/pg/query";
import type { Job, Candidate, Submission } from "@/types/domain";

export async function listJobs(tenantId: string): Promise<Job[]> {
  return query<Job>(
    `select id, tenant_id as "tenantId", title, status, priority,
            client_name as "clientId", location, compensation, metadata,
            created_at as "createdAt"
     from jobs where tenant_id = $1 order by created_at desc`,
    [tenantId],
  );
}

export async function listCandidates(tenantId: string): Promise<Candidate[]> {
  return query<Candidate>(
    `select id, tenant_id as "tenantId", full_name as "fullName", email, phone,
            location, summary, metadata, created_at as "createdAt"
     from candidates where tenant_id = $1 order by created_at desc`,
    [tenantId],
  );
}

export async function listSubmissions(tenantId: string): Promise<Submission[]> {
  return query<Submission>(
    `select id, tenant_id as "tenantId", candidate_id as "candidateId",
            job_id as "jobId", stage, score, rationale, created_at as "createdAt"
     from submissions where tenant_id = $1 order by created_at desc`,
    [tenantId],
  );
}
