import Link from "next/link";
import { appContext } from "@/lib/app/demo-context";
import {
  shortlistBuilderAgent,
  onboardingAgent,
  supportTriageAgent,
  claimsValidationAgent,
  accountRiskMonitorAgent,
} from "@/lib/domains";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

const AGENT_FACTORIES: Record<string, (tenantId: string) => { name: string; description?: string | null; graph: { nodes: { id: string; kind: string }[] } }> = {
  shortlist_builder: shortlistBuilderAgent,
  onboarding: onboardingAgent,
  support_triage: supportTriageAgent,
  claims_validation: claimsValidationAgent,
  account_risk_monitor: accountRiskMonitorAgent,
};

export default async function AgentDetailPage({
  params,
}: {
  params: { agentId: string };
}) {
  const ctx = await appContext();
  const factory = AGENT_FACTORIES[params.agentId];

  if (!factory) {
    return (
      <>
        <PageHeader title="Agent" />
        <Placeholder title="Agent not found" note={`No agent registered for "${params.agentId}".`} />
      </>
    );
  }

  const agent = factory(ctx.tenantId);

  return (
    <>
      <PageHeader title={agent.name} sub={agent.description ?? undefined} />
      <div className="card">
        <h3>{agent.name}</h3>
        <p className="muted">{agent.description ?? "—"}</p>
        <table>
          <thead>
            <tr>
              <th>Node ID</th>
              <th>Kind</th>
            </tr>
          </thead>
          <tbody>
            {agent.graph.nodes.map((n) => (
              <tr key={n.id}>
                <td>
                  <code>{n.id}</code>
                </td>
                <td>
                  <span className="badge neutral">{n.kind}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 16 }}>
          <Link href="./runs">Runs</Link>
          <Link href="./evals">Evals</Link>
        </div>
      </div>
    </>
  );
}
