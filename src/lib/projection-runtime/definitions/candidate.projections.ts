// Candidate projections — several SURFACES over the one Candidate object
// definition, demonstrating surface-independence: the same domain object renders
// as a modal, a full page, a grid, a calendar item, and a graph node without any
// change to candidate.object.ts.

import type { ProjectionDefinition } from "../contracts/projection-definition";

/** Create-candidate as a centered modal (launched from the Command Center). */
export const candidateCreateModal: ProjectionDefinition = {
  id: "Candidate.Create.Modal",
  objectType: "Candidate",
  surface: "modal",
  mode: "create",
  title: "New candidate",
  description: "Create a candidate. This emits a governed Candidate.CreateRequested intent.",
  primaryIntent: "Candidate.CreateRequested",
  layout: [
    { id: "identity", title: "Identity", fields: ["fullName", "email"], columns: 2 },
    { id: "profile", title: "Profile", fields: ["location", "summary", "status"], columns: 1 },
  ],
};

/** The same create experience as a full page. Identical object definition. */
export const candidateCreatePage: ProjectionDefinition = {
  id: "Candidate.Create.FullPage",
  objectType: "Candidate",
  surface: "fullPage",
  mode: "create",
  title: "Create candidate",
  description: "Metadata-driven create surface, rendered full-page from the same definition.",
  primaryIntent: "Candidate.CreateRequested",
  layout: [
    { id: "identity", title: "Identity", fields: ["fullName", "email"], columns: 2 },
    { id: "profile", title: "Profile", fields: ["location", "summary"], columns: 1 },
    { id: "lifecycle", title: "Lifecycle", fields: ["status"], columns: 1 },
  ],
};

/** Grid (list) projection: same object, no layout — display columns instead. */
export const candidateGrid: ProjectionDefinition = {
  id: "Candidate.Grid",
  objectType: "Candidate",
  surface: "grid",
  mode: "list",
  title: "Candidates",
  display: {
    columns: [
      { field: "fullName", label: "Name" },
      { field: "email", label: "Email" },
      { field: "location", label: "Location" },
      { field: "status", label: "Stage" },
    ],
  },
};

/** Graph node projection: same object, label binding only. */
export const candidateGraphNode: ProjectionDefinition = {
  id: "Candidate.GraphNode",
  objectType: "Candidate",
  surface: "graph",
  mode: "view",
  title: "Candidate node",
  display: { nodeLabelField: "fullName" },
};

export const candidateProjections: ProjectionDefinition[] = [
  candidateCreateModal,
  candidateCreatePage,
  candidateGrid,
  candidateGraphNode,
];
