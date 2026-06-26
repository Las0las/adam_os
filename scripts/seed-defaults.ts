// Phase 9 — seed default platform config for a tenant (env/policies/packs/evals).
import { bootstrapTenant } from "../src/lib/setup/tenant-bootstrap-service";

async function main(): Promise<void> {
  const tenantId = process.env.SEED_TENANT_ID ?? "tnt_demo";
  const bundleKey = process.env.SEED_BUNDLE ?? "staffing_recruiting_os";
  const result = await bootstrapTenant({ tenantId, bundleKey });
  // eslint-disable-next-line no-console
  console.log(`Seeded ${tenantId}: ${JSON.stringify(result)}`);
}
void main();
