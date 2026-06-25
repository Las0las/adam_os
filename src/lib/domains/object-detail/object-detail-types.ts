// Phase 5 — Object Detail contract (Part C1). One shape powers the detail drawer
// and full-page detail views for every object type.

import type { CommandActionRef } from "../command-center/command-center-types";

export interface ObjectDetail {
  object: {
    objectType: string;
    objectId: string;
    title?: string | null;
    status?: string | null;
    properties: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
  };
  relationships: Array<{
    linkType: string;
    direction: "inbound" | "outbound";
    objectType: string;
    objectId: string;
    title?: string | null;
  }>;
  evidence: Array<{
    objectType: string;
    objectId: string;
    chunkId?: string | null;
    excerpt: string;
    score?: number | null;
    method?: string | null;
    metadata?: Record<string, unknown>;
  }>;
  actions: CommandActionRef[];
  reviews: Array<{
    id: string;
    status: string;
    severity?: string | null;
    summary?: string | null;
    createdAt: string;
  }>;
  traces: Array<{
    runType: "function" | "agent" | "action";
    runId: string;
    status: string;
    summary?: string | null;
    createdAt: string;
  }>;
  audit: Array<{
    id: string;
    eventType: string;
    actor?: string | null;
    createdAt: string;
    payload?: Record<string, unknown>;
  }>;
}
