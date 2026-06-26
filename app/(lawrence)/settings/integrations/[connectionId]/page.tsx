import { IntegrationConnectionDetail } from "@/components/lawrence/integrations/IntegrationConnectionDetail";

export const dynamic = "force-dynamic";

export default function IntegrationConnectionPage({
  params,
}: {
  params: { connectionId: string };
}) {
  return <IntegrationConnectionDetail connectionId={params.connectionId} />;
}
