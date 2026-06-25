import { appContext } from "@/lib/app/demo-context";
import { PageHeader, Placeholder } from "@/components/lawrence/shared/widgets";

export const dynamic = "force-dynamic";

export default async function NewAgentPage() {
  await appContext();

  return (
    <>
      <PageHeader title="New Agent" />
      <Placeholder title="New Agent" />
    </>
  );
}
