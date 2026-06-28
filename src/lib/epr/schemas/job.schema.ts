import type { ObjectSchema } from "../contracts";

/** Job requisition projected over EPR-001. Data only — no logic. */
export const jobSchema: ObjectSchema = {
  objectType: "Job",
  label: "Job Requisition",
  glyph: "JOB",
  studio: "Job Studio",
  identityKeys: ["title"],
  governKey: "approval",
  sections: [
    {
      id: "identity",
      name: "Identity",
      hint: "What role is this, and where does it sit?",
      fields: [
        { key: "title", label: "Role title", short: "title", kind: "single", req: true,
          chips: ["Senior Power BI Developer", "Data Engineer", "Analytics Engineer", "BI Architect"] },
        { key: "department", label: "Department", short: "dept", kind: "single",
          chips: ["Data & Analytics", "Engineering", "Finance", "Operations"] },
        { key: "location", label: "Location", short: "location", kind: "single", req: true,
          chips: ["Remote (US)", "Hybrid — NYC", "On-site — London"] },
      ],
    },
    {
      id: "requirements",
      name: "Requirements",
      hint: "Capabilities the candidate must demonstrate.",
      fields: [
        { key: "skills", label: "Required skills", short: "skills", kind: "multi", req: true, min: 2, norm: true,
          chips: ["Power BI", "DAX", "Power Query", "SQL", "Azure", "Data Modeling"],
          related: { "Power BI": ["DAX", "Power Query"], Azure: ["Synapse", "Fabric"] } },
        { key: "seniority", label: "Seniority", short: "seniority", kind: "single",
          chips: ["Mid", "Senior", "Staff", "Principal"] },
      ],
    },
    {
      id: "commercials",
      name: "Commercials",
      hint: "Compensation and approval.",
      fields: [
        { key: "comp", label: "Compensation band", short: "comp", kind: "single",
          chips: ["$120–150k", "$150–180k", "$180–210k"] },
        { key: "approval", label: "Hiring approval", short: "approval", kind: "single",
          chips: ["Approved — VP Eng", "Pending"] },
      ],
    },
  ],
  recs: [
    { label: "Benchmark compensation against market", gain: 12, kind: "market", key: "comp" },
    { label: "Add a seniority level", gain: 8, kind: "fill", key: "seniority" },
    { label: "Normalize skills to canonical taxonomy", gain: 6, kind: "normalize", key: "skills" },
    { label: "Record hiring approval (governance)", gain: 10, kind: "fill", key: "approval" },
    { label: "Add a department", gain: 4, kind: "fill", key: "department" },
  ],
};
