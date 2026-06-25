import { appContext } from "@/lib/app/demo-context";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function PipelinePreviewPage({
  params,
}: {
  params: { pipelineId: string };
}) {
  await appContext();

  return (
    <>
      <PageHeader title="Pipeline Preview" sub={params.pipelineId} />
      <Placeholder title="Pipeline Preview" />
    </>
  );
}
