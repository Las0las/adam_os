"use client";

// Phase 9 — integration connection mutation actions. Create a connection,
// test its health, and run a sync. Each method POSTs the relevant endpoint,
// parses the { ok, data, error } envelope, tracks shared { pending, error },
// and refetches via onSettled.

import { useCallback } from "react";
import type {
  IntegrationConnection,
  IntegrationHealthResult,
  IntegrationProvider,
  IntegrationSyncRun,
  SyncType,
} from "@/lib/integrations/integration-types";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";

export interface CreateConnectionFormInput {
  key: string;
  name: string;
  provider: IntegrationProvider;
  config?: Record<string, unknown>;
  credentialRef?: string;
}

export interface UseIntegrationActions {
  pending: boolean;
  error: string | null;
  create: (input: CreateConnectionFormInput) => Promise<Envelope<IntegrationConnection>>;
  test: (connectionId: string) => Promise<Envelope<IntegrationHealthResult>>;
  sync: (connectionId: string, syncType?: SyncType) => Promise<Envelope<IntegrationSyncRun>>;
}

export function useIntegrationActions(onSettled: () => void): UseIntegrationActions {
  const { pending, error, run } = useMutationRunner(onSettled);

  const create = useCallback(
    (input: CreateConnectionFormInput) =>
      run(() => postJson<IntegrationConnection>("/api/integrations", input)) as Promise<
        Envelope<IntegrationConnection>
      >,
    [run],
  );

  const test = useCallback(
    (connectionId: string) =>
      run(() =>
        postJson<IntegrationHealthResult>(
          `/api/integrations/${encodeURIComponent(connectionId)}/test`,
        ),
      ) as Promise<Envelope<IntegrationHealthResult>>,
    [run],
  );

  const sync = useCallback(
    (connectionId: string, syncType?: SyncType) =>
      run(() =>
        postJson<IntegrationSyncRun>(
          `/api/integrations/${encodeURIComponent(connectionId)}/sync`,
          syncType ? { syncType } : undefined,
        ),
      ) as Promise<Envelope<IntegrationSyncRun>>,
    [run],
  );

  return { pending, error, create, test, sync };
}
