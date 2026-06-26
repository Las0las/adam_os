"use client";

// Phase 9 — tenant setup mutation actions. Bootstrap a tenant, install the
// default pack bundle, and seed default environments / approval policies. Each
// method POSTs the relevant setup endpoint, parses the { ok, data, error }
// envelope, tracks shared { pending, error }, and refetches via onSettled.

import { useCallback } from "react";
import type { BootstrapResult } from "@/lib/setup/tenant-bootstrap-types";
import { postJson, useMutationRunner, type Envelope } from "./missionControlPost";

export interface BootstrapFormInput {
  bundleKey?: string;
  packKeys?: string[];
  adminEmail?: string;
  integrationShells?: Array<{ key: string; name: string; provider: string }>;
}

export interface UseSetupActions {
  pending: boolean;
  error: string | null;
  bootstrap: (input: BootstrapFormInput) => Promise<Envelope<BootstrapResult>>;
  installPacks: (bundleKey?: string) => Promise<Envelope<BootstrapResult>>;
  createEnvironments: () => Promise<Envelope>;
  createApprovalPolicies: () => Promise<Envelope>;
}

export function useSetupActions(onSettled: () => void): UseSetupActions {
  const { pending, error, run } = useMutationRunner(onSettled);

  const bootstrap = useCallback(
    (input: BootstrapFormInput) =>
      run(() => postJson<BootstrapResult>("/api/setup/bootstrap-tenant", input)) as Promise<
        Envelope<BootstrapResult>
      >,
    [run],
  );

  const installPacks = useCallback(
    (bundleKey?: string) =>
      run(() =>
        postJson<BootstrapResult>(
          "/api/setup/install-default-packs",
          bundleKey ? { bundleKey } : undefined,
        ),
      ) as Promise<Envelope<BootstrapResult>>,
    [run],
  );

  const createEnvironments = useCallback(
    () => run(() => postJson("/api/setup/create-default-environments")),
    [run],
  );

  const createApprovalPolicies = useCallback(
    () => run(() => postJson("/api/setup/create-default-approval-policies")),
    [run],
  );

  return { pending, error, bootstrap, installPacks, createEnvironments, createApprovalPolicies };
}
