import { EvalRunDetailClient } from "@/components/lawrence/evals/EvalRunDetailClient";

export const dynamic = "force-dynamic";

export default function EvalRunDetailPage({
  params,
}: {
  params: { evalSuiteId: string; evalRunId: string };
}) {
  return <EvalRunDetailClient evalRunId={params.evalRunId} />;
}
