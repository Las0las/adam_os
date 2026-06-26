// Phase 9 — request a rollback through Mission Control (reason + approval gated).
import { systemActor } from "../src/lib/lawrence-core/permissions/permissions";
import { requestRollback } from "../src/lib/mission-control/deployments/rollback-service";

async function main(): Promise<void> {
  const tenantId = process.env.TENANT_ID ?? "tnt_demo";
  const releaseId = process.argv[2];
  const reason = process.argv[3] ?? "operator-initiated rollback";
  if (!releaseId) {
    // eslint-disable-next-line no-console
    console.error("usage: tsx scripts/rollback-release.ts <releaseId> <reason>");
    process.exit(1);
    return;
  }
  const record = await requestRollback(systemActor(tenantId), { releaseBundleId: releaseId, reason });
  // eslint-disable-next-line no-console
  console.log(`Rollback ${record.id}: ${record.status}`);
}
void main();
