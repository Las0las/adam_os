// Projection Studio — server entry.
//
// Grounds the studio in the LIVE projection registry (so DSL field/intent
// references validate against REAL object definitions) and mints a REAL
// ExecutionAuthority from the kernel for the acquisition session. All of this is
// serialized and handed to the client surface; the client never imports the
// (server-only) runtime barrel.

import { listEnterpriseObjects, listProjections } from "@/lib/projection-runtime";
import { Kernel } from "@/lib/kernel";
import type { ConstitutionActor } from "@/lib/constitution";
import type { CompilerEnv, ProjectionArtifact, SessionAuthority } from "@/lib/projection-studio/contracts";
import { serializeDsl } from "@/lib/projection-studio/engine";
import { ProjectionStudio } from "@/components/lawrence/studio/ProjectionStudio";

export const metadata = {
  title: "LAWRENCE — Projection Studio",
  description: "Edit ProjectionDefinition DSL with governed context acquisition. Sources never mutate projections directly.",
};

export default function ProjectionStudioPage() {
  const objects = listEnterpriseObjects();
  const projections = listProjections();

  const env: CompilerEnv = {
    objectTypes: objects.map((o) => o.objectType),
    surfaces: ["modal", "drawer", "fullPage", "grid", "calendar", "document", "graph", "command"],
    modes: ["create", "edit", "view", "list"],
    fieldsByObjectType: Object.fromEntries(objects.map((o) => [o.objectType, o.fields.map((f) => f.key)])),
    intentsByObjectType: Object.fromEntries(objects.map((o) => [o.objectType, o.intents.map((i) => i.name)])),
  };

  const artifacts: ProjectionArtifact[] = projections.map((p) => ({
    id: p.id,
    objectType: p.objectType,
    surface: p.surface,
    mode: p.mode,
    title: p.title,
    dsl: serializeDsl(p),
  }));

  // Open the acquisition session under a real authority issued by the kernel's
  // Constitution Runtime. Fixed clock keeps the seeded session deterministic.
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const actor: ConstitutionActor = {
    kind: "human",
    id: "user_builder_01",
    tenantId: "lawrence",
    label: "Builder",
    permissions: ["projection:read", "projection:edit"],
  };
  const seeded = Kernel.requestAuthority(
    {
      kind: "projection.resolve",
      actor,
      enterpriseId: "lawrence",
      projection: { objectType: artifacts[0]?.objectType ?? "Candidate", projectionId: artifacts[0]?.id ?? "Candidate.Create.FullPage", surface: artifacts[0]?.surface ?? "fullPage" },
      audited: true,
    },
    now,
  );
  const sessionAuthority: SessionAuthority = {
    authorityId: seeded.authorityId,
    decisionId: seeded.decisionId,
    granted: seeded.granted,
    capabilities: seeded.capabilities,
    signature: seeded.signature,
    issuedAt: seeded.issuedAt,
    expiresAt: seeded.expiresAt,
  };

  // Prefer a form surface (has a layout to patch) as the initial artifact.
  const initialArtifactId =
    artifacts.find((a) => a.id === "Candidate.Create.FullPage")?.id ?? artifacts[0]?.id ?? "";

  return (
    <ProjectionStudio
      env={env}
      artifacts={artifacts}
      sessionAuthority={sessionAuthority}
      actor={actor}
      enterpriseId="lawrence"
      initialArtifactId={initialArtifactId}
    />
  );
}
