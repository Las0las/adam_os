import { EvalSuiteDetailClient } from "@/components/lawrence/evals/EvalSuiteDetailClient";

export const dynamic = "force-dynamic";

export default function EvalSuiteDetailPage({
  params,
}: {
  params: { evalSuiteId: string };
}) {
  return <EvalSuiteDetailClient evalSuiteId={params.evalSuiteId} />;
}
