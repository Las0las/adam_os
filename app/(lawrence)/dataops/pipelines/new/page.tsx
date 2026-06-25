import { appContext } from "@/lib/app/demo-context";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function NewPipelinePage() {
  await appContext();

  return (
    <>
      <PageHeader title="New Pipeline" />
      <Placeholder
        title="New Pipeline"
        note="Drag-and-drop pipeline canvas (React Flow) lands in a later pass."
      />
    </>
  );
}
