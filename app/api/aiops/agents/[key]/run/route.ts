import { NextResponse } from "next/server";
import { appContext } from "@/lib/app/demo-context";
import { runAgent } from "@/lib/aiops/agents/agent-runner";
import {
  shortlistBuilderAgent,
  supportTriageAgent,
  claimsValidationAgent,
  onboardingAgent,
  accountRiskMonitorAgent,
} from "@/lib/domains";
import type { AgentDefinition } from "@/types/aiops";

// POST /api/aiops/agents/:key/run  body: { input: {...} }
export async function POST(
  request: Request,
  { params }: { params: { key: string } },
) {
  const ctx = await appContext();
  const factories: Record<string, (t: string) => AgentDefinition> = {
    shortlist_builder: shortlistBuilderAgent,
    support_triage: supportTriageAgent,
    claims_validation: claimsValidationAgent,
    onboarding: onboardingAgent,
    account_risk_monitor: accountRiskMonitorAgent,
  };
  const factory = factories[params.key];
  if (!factory) return NextResponse.json({ error: `Unknown agent: ${params.key}` }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { input?: Record<string, unknown> };
  const run = await runAgent(ctx, factory(ctx.tenantId), body.input ?? {});
  return NextResponse.json(run, { status: run.status === "failed" ? 422 : 200 });
}
