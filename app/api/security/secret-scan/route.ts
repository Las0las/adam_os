import { appContext } from "@/lib/app/demo-context";
import { run } from "@/lib/app/route-helpers";
import { scanTenantForSecrets } from "@/lib/security/secret-scanner-service";

export const dynamic = "force-dynamic";

// POST /api/security/secret-scan — scan tenant surfaces for inline secrets.
export async function POST() {
  const ctx = await appContext();
  return run(() => scanTenantForSecrets(ctx));
}
