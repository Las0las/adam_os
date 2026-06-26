// Phase 9 — build a release bundle through Mission Control (never bypasses gates).
import { systemActor } from "../src/lib/lawrence-core/permissions/permissions";
import { createReleaseBundle } from "../src/lib/mission-control/deployments/release-bundle-service";

async function main(): Promise<void> {
  const tenantId = process.env.TENANT_ID ?? "tnt_demo";
  const ctx = systemActor(tenantId);
  const key = process.argv[2] ?? `release-${Date.now()}`;
  const target = process.argv[3] ?? "staging";
  const { release } = await createReleaseBundle(ctx, {
    key,
    name: key,
    releaseType: "config",
    targetEnvironmentKey: target,
    items: [{ itemType: "config", itemKey: key, changeType: "update" }],
  });
  // eslint-disable-next-line no-console
  console.log(`Created release ${release.id} -> ${target}`);
}
void main();
