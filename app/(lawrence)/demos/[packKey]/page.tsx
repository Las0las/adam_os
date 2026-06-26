import { DemoCatalog } from "@/components/lawrence/demos/DemoCatalog";

export const dynamic = "force-dynamic";

// Demos scoped to a single pack — DemoCatalog fetches /api/demos/[packKey] and
// renders a DemoScenarioCard for each scenario.
export default function PackDemosPage({
  params,
}: {
  params: { packKey: string };
}) {
  return (
    <DemoCatalog
      packKey={params.packKey}
      title="Pack Demos"
      sub={params.packKey}
    />
  );
}
