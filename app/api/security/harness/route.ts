import { appContext } from "@/lib/app/demo-context";
import { run } from "@/lib/app/route-helpers";
import { runSecurityHarness } from "@/lib/security/security-test-harness";

export const dynamic = "force-dynamic";

// POST /api/security/harness — run the security control self-test probes.
export async function POST() {
  const ctx = await appContext();
  return run(() => runSecurityHarness(ctx));
}
