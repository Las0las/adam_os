import type { ObjectSchema } from "../contracts";

/** Candidate projected over EPR-001 — same runtime, different schema. */
export const candidateSchema: ObjectSchema = {
  objectType: "Candidate",
  label: "Candidate",
  glyph: "⟨Candidate⟩",
  identityKeys: ["fullName"],
  governKey: "consent",
  sections: [
    {
      id: "identity",
      name: "Identity",
      hint: "Who is this person? Identity needs a name or an email.",
      fields: [
        { key: "fullName", label: "Full name", short: "name", kind: "single", req: true,
          chips: ["Grace Hopper", "Ada Lovelace"] },
        { key: "email", label: "Email", short: "email", kind: "single",
          chips: ["grace@example.com"] },
        { key: "location", label: "Location", short: "location", kind: "single",
          chips: ["Remote (US)", "Boston, MA", "London, UK"] },
      ],
    },
    {
      id: "capability",
      name: "Capability",
      hint: "What can this candidate demonstrably do?",
      fields: [
        { key: "skills", label: "Skills", short: "skills", kind: "multi", req: true, min: 2, norm: true,
          chips: ["Power BI", "DAX", "SQL", "Python", "Azure", "System Design"],
          related: { "Power BI": ["DAX", "Power Query"], Python: ["Pandas", "FastAPI"] } },
        { key: "title", label: "Current title", short: "title", kind: "single",
          chips: ["Senior BI Developer", "Data Engineer", "Analytics Lead"] },
      ],
    },
    {
      id: "engagement",
      name: "Engagement",
      hint: "Compensation expectations and consent to represent.",
      fields: [
        { key: "comp", label: "Comp expectation", short: "comp", kind: "single",
          chips: ["$140–160k", "$160–185k", "$185–210k"] },
        { key: "consent", label: "Representation consent", short: "consent", kind: "single",
          chips: ["Consented", "Pending"] },
      ],
    },
  ],
  recs: [
    { label: "Benchmark expectations against market", gain: 12, kind: "market", key: "comp" },
    { label: "Capture representation consent (governance)", gain: 10, kind: "fill", key: "consent" },
    { label: "Add an email to strengthen identity", gain: 8, kind: "fill", key: "email" },
    { label: "Normalize skills to canonical taxonomy", gain: 6, kind: "normalize", key: "skills" },
    { label: "Add current title", gain: 4, kind: "fill", key: "title" },
  ],
};
