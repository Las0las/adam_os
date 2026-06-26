// Phase 9 — provision a new enterprise tenant from the CLI.
import { bootstrapTenant } from "../src/lib/setup/tenant-bootstrap-service";

async function main(): Promise<void> {
  const tenantId = process.argv[2] ?? process.env.TENANT_ID;
  if (!tenantId) {
    // eslint-disable-next-line no-console
    console.error("usage: tsx scripts/bootstrap-tenant.ts <tenantId> [bundleKey]");
    process.exit(1);
    return;
  }
  const bundleKey = process.argv[3] ?? "staffing_recruiting_os";
  const result = await bootstrapTenant({ tenantId, bundleKey });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}
void main();
