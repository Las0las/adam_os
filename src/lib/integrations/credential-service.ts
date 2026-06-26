// Phase 9 — credential service. The DB only ever stores a credentialRef (an env
// var name / secret-manager key), never a secret value. Resolution reads from
// the environment (the secret-manager abstraction). Secret values are never
// logged or returned to clients.

export interface CredentialResolution {
  ref: string;
  present: boolean;
}

/** Resolve a credential value by ref. Returns null when absent (fail-closed). */
export function getCredential(_tenantId: string, credentialRef?: string | null): string | null {
  if (!credentialRef) return null;
  const value = process.env[credentialRef];
  return value && value.length > 0 ? value : null;
}

/** Whether a credential ref resolves to a present secret — without returning it. */
export function validateCredentialRef(tenantId: string, credentialRef?: string | null): CredentialResolution {
  return { ref: credentialRef ?? "", present: getCredential(tenantId, credentialRef) !== null };
}

/** Mask a credential ref for display (never reveals the secret value). */
export function maskCredentialRef(ref?: string | null): string {
  if (!ref) return "(none)";
  if (ref.length <= 4) return "****";
  return `${ref.slice(0, 2)}…${ref.slice(-2)}`;
}
