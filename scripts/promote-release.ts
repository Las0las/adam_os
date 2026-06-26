// Phase 9 — promote a release through Mission Control (fail-closed prod gate).
import { systemActor } from "../src/lib/lawrence-core/permissions/permissions";
import { promoteRelease } from "../src/lib/mission-control/deployments/release-promotion-service";

async function main(): Promise<void> {
  const tenantId = process.env.TENANT_ID ?? "tnt_demo";
  const releaseId = process.argv[2];
  if (!releaseId) {
    // eslint-disable-next-line no-console
    console.error("usage: tsx scripts/promote-release.ts <releaseId>");
    process.exit(1);
    return;
  }
  const promoted = await promoteRelease(systemActor(tenantId), releaseId);
  // eslint-disable-next-line no-console
  console.log(`Promoted ${promoted.id}: ${promoted.status}`);
}
void main();
