// Candidate — the first EnterpriseObjectDefinition. ALL Candidate domain logic
// (fields, validation, lifecycle, intents, post-create) lives here as metadata,
// not in any React component. The canonical contract this mirrors is
// dataops/ontology/schemas/candidate.schema.ts: status domain
// new|active|placed|archived, and "at least one of fullName | email".

import type { EnterpriseObjectDefinition } from "../contracts/enterprise-object";

export const candidateObject: EnterpriseObjectDefinition = {
  objectType: "Candidate",
  displayName: "Candidate",
  pluralName: "Candidates",
  titleField: "fullName",
  fields: [
    {
      key: "fullName",
      label: "Full name",
      type: "text",
      binding: { target: "title" },
      placeholder: "Ada Lovelace",
      helpText: "At least one of full name or email is required.",
      validations: [{ kind: "maxLength", value: 160, message: "Name is too long." }],
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      binding: { target: "property", path: "email" },
      placeholder: "ada@example.com",
      validations: [{ kind: "email", message: "Enter a valid email address." }],
    },
    {
      key: "location",
      label: "Location",
      type: "text",
      binding: { target: "property", path: "location" },
      placeholder: "London, UK",
    },
    {
      key: "summary",
      label: "Summary",
      type: "textarea",
      binding: { target: "property", path: "summary" },
      placeholder: "Short professional summary used for retrieval and matching.",
    },
    {
      key: "status",
      label: "Stage",
      type: "select",
      binding: { target: "status" },
      options: [
        { value: "new", label: "New" },
        { value: "active", label: "Active" },
        { value: "placed", label: "Placed" },
        { value: "archived", label: "Archived" },
      ],
      defaultValue: "new",
    },
  ],
  objectValidations: [
    {
      kind: "anyOf",
      fields: ["fullName", "email"],
      message: "A candidate must have at least one of full name or email.",
    },
  ],
  lifecycle: {
    states: [
      { value: "new", label: "New", initial: true },
      { value: "active", label: "Active" },
      { value: "placed", label: "Placed" },
      { value: "archived", label: "Archived", terminal: true },
    ],
    transitions: [
      { from: "new", to: "active", intent: "Candidate.ActivateRequested", label: "Activate" },
      { from: "active", to: "placed", intent: "Candidate.PlaceRequested", label: "Mark placed" },
      { from: "new", to: "archived", intent: "Candidate.ArchiveRequested", label: "Archive" },
      { from: "active", to: "archived", intent: "Candidate.ArchiveRequested", label: "Archive" },
    ],
  },
  intents: [
    {
      name: "Candidate.CreateRequested",
      operation: "create",
      actionKey: "candidate.create",
      label: "Create candidate",
      variant: "primary",
      requiredPermission: "ontology.admin",
      requiresApproval: false,
    },
  ],
  postActions: [
    {
      kind: "navigate",
      href: "/recruiting/candidates/{id}",
      forOperations: ["create"],
    },
    {
      kind: "toast",
      message: "Candidate created.",
      forOperations: ["create"],
    },
  ],
};
