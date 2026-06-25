import { appContext } from "@/lib/app/demo-context";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function AgentEvalsPage({
  params,
}: {
  params: { agentId: string };
}) {
  await appContext();

  return (
    <>
      <PageHeader title={`Evals · ${params.agentId}`} />
      <Placeholder title="Agent Evals" />
    </>
  );
}
