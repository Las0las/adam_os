import { DemoRunnerLoader } from "@/components/lawrence/demos/DemoRunnerLoader";

export const dynamic = "force-dynamic";

export default function DemoRunnerRoutePage({
  params,
}: {
  params: { packKey: string; demoKey: string };
}) {
  return (
    <DemoRunnerLoader packKey={params.packKey} demoKey={params.demoKey} />
  );
}
