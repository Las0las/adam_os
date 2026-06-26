import { appContext } from "@/lib/app/demo-context";
import { run, readJson } from "@/lib/app/route-helpers";
import { resetDemo } from "@/lib/demo/demo-reset-service";

export const dynamic = "force-dynamic";

// POST /api/demos/[packKey]/[demoKey]/reset  body: { removeTraces? }
export async function POST(request: Request, { params }: { params: { packKey: string; demoKey: string } }) {
  const ctx = await appContext();
  const body = await readJson<{ removeTraces?: boolean }>(request);
  return run(() => resetDemo(ctx, params.packKey, { removeTraces: body.removeTraces }));
}
