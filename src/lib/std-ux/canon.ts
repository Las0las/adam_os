/**
 * STD-UX-0001 — LAWRENCE Enterprise Interaction Canon
 * ===================================================
 * The constitutional INTERACTION contract (distinct from LDS-001 visual language
 * and the EPR/EOE runtime). It defines BEHAVIOR — not styling, not layout — that
 * every Host Runtime, Studio, Domain Pack, Projection, and Advisor MUST implement.
 *
 * This module is the machine-readable source of truth. The /interaction-canon
 * reference surface is a PROJECTION of it (the page cannot drift from the standard),
 * and the ObjectActionBar primitive enforces Part III at runtime.
 *
 * Layering:  RFC-C0 Constitution → RFC-K0 Kernel → STD-UX-0001 (this) →
 *            LDS-001 Visual → EPR/EOE Runtime → Studios → Domain Packs → Hosts
 */

export type Normativity = "MUST" | "SHALL" | "MUST NOT" | "SHOULD";

export interface Contract {
  /** Normative keyword (RFC-2119 style). */
  level: Normativity;
  /** The behavioral requirement. Describes behavior, never implementation. */
  text: string;
}

export interface CanonPart {
  id: string;
  /** e.g. "Part I". */
  numeral: string;
  title: string;
  /** One-line reframing of the domain (behavioral, not UI). */
  thesis: string;
  /** The vocabulary this domain governs (primitives / capabilities). */
  vocabulary: string[];
  /** Normative contracts every implementation must satisfy. */
  contracts: Contract[];
}

/* ------------------------------------------------------------------ *
 * Part III — the inherited Object Action set.
 * These are not buttons; they are capabilities EVERY Enterprise Object
 * inherits identically. The ObjectActionBar primitive renders this set.
 * ------------------------------------------------------------------ */

export type ActionKind =
  | "view" | "edit" | "evolve" | "copy" | "reference" | "insert"
  | "share" | "compare" | "discuss" | "advisor" | "pin" | "branch"
  | "duplicate" | "history" | "archive";

export interface ObjectActionDef {
  kind: ActionKind;
  label: string;
  /** Short behavioral contract for this capability. */
  contract: string;
  /** True for the capability that is uniquely LAWRENCE (not borrowed from M365/etc). */
  signature?: boolean;
  /** Mutating actions route through the governed runtime; they never mutate directly. */
  governed?: boolean;
}

export const OBJECT_ACTIONS: ObjectActionDef[] = [
  { kind: "view", label: "View", contract: "Open the object in its current projection." },
  { kind: "edit", label: "Edit", contract: "Acquire context into properties via PSI; never an opaque edit mode." },
  { kind: "evolve", label: "Evolve", contract: "Ask the Advisor to advance the object to its next maturity state.", signature: true, governed: true },
  { kind: "copy", label: "Copy", contract: "Copy a portable, provenance-preserving representation." },
  { kind: "reference", label: "Reference", contract: "Create a stable deep-link reference to this object." },
  { kind: "insert", label: "Insert", contract: "Insert the object (by reference) into another surface." },
  { kind: "compare", label: "Compare", contract: "Open a side-by-side comparison with peer objects." },
  { kind: "discuss", label: "Discuss", contract: "Attach a conversation as evidence on the object." },
  { kind: "advisor", label: "Ask Advisor", contract: "Reason over the object; cite evidence and disclose confidence.", governed: true },
  { kind: "history", label: "History", contract: "Inspect the complete, append-only evolution history." },
  { kind: "branch", label: "Branch", contract: "Fork a governed variant where policy permits.", governed: true },
  { kind: "duplicate", label: "Duplicate", contract: "Mint a new object seeded from this one." },
  { kind: "pin", label: "Pin", contract: "Pin the object into Enterprise Navigation." },
  { kind: "share", label: "Share", contract: "Grant governed access to the object." },
  { kind: "archive", label: "Archive", contract: "Soft-archive (tombstone); history is preserved.", governed: true },
];

/* ------------------------------------------------------------------ *
 * The six behavioral domains.
 * ------------------------------------------------------------------ */

export const CANON_PARTS: CanonPart[] = [
  {
    id: "navigation",
    numeral: "Part I",
    title: "Enterprise Navigation",
    thesis: "Not menus — movement through the Enterprise Graph.",
    vocabulary: ["Pinned", "Assigned", "Recent", "Drafts", "Needs Review", "Favorites", "Archive", "Global Search", "Relationship Explorer"],
    contracts: [
      { level: "MUST", text: "Navigation MUST expose governed Enterprise Objects (Candidate, Mission, Contract), never implementation resources (Files, Chats, Projects)." },
      { level: "MUST", text: "Every object MUST be reachable by Global Search and by graph traversal from a related object." },
      { level: "MUST", text: "Pinned / Recent / Assigned / Drafts / Needs Review collections MUST be derivable from object state, not hand-curated lists." },
    ],
  },
  {
    id: "objects",
    numeral: "Part II",
    title: "Enterprise Objects",
    thesis: "Every Enterprise Object inherits an identical interaction contract — no exceptions.",
    vocabulary: ["Identity", "Properties", "Relationships", "Evidence", "Activity", "Actions", "Advisor", "Object Intelligence", "History"],
    contracts: [
      { level: "SHALL", text: "Every object SHALL expose Identity, Properties, Relationships, Evidence, Activity, Actions, Advisor, Object Intelligence, and History." },
      { level: "MUST", text: "Every object MUST expose a stable identity and support deep-linking and referencing." },
      { level: "MUST", text: "Every object MUST preserve complete, append-only history and support comparison." },
      { level: "MUST", text: "Whether Candidate, Invoice, Workflow, Policy, Meeting, or Agent — the contract MUST be identical." },
    ],
  },
  {
    id: "actions",
    numeral: "Part III",
    title: "Enterprise Actions",
    thesis: "Don't document buttons — document inherited capabilities. Every object supports the same action set.",
    vocabulary: OBJECT_ACTIONS.map((a) => a.label),
    contracts: [
      { level: "SHALL", text: "Every object SHALL support the full inherited action set, including the signature LAWRENCE action: Evolve." },
      { level: "MUST", text: "Mutating actions (Evolve, Branch, Archive, Ask Advisor) MUST route through the governed runtime; an action MUST NOT mutate object state directly." },
      { level: "MUST", text: "Evolve MUST advance the object via the Advisor toward its next maturity state, recording provenance." },
    ],
  },
  {
    id: "context",
    numeral: "Part IV",
    title: "Context Acquisition",
    thesis: "Acquisition is a Runtime, not a file picker. Everything becomes Evidence.",
    vocabulary: ["Paste", "Upload", "Import", "Screenshot", "Clipboard", "Browser", "Research", "Slack", "Teams", "SharePoint", "GitHub", "API", "Database", "Meeting", "Email", "Generate"],
    contracts: [
      { level: "MUST", text: "All acquisition MUST produce Context → Evidence → Object Evolution; it MUST NOT mutate the object directly." },
      { level: "MUST", text: "Acquisition MUST preserve provenance and retain original sources." },
      { level: "MUST", text: "Acquisition MUST distinguish imported context from generated context, and support attribution." },
    ],
  },
  {
    id: "reasoning",
    numeral: "Part V",
    title: "Enterprise Reasoning",
    thesis: "The Advisor is a constitutional capability, not a sidebar. The panel is merely one projection.",
    vocabulary: ["Advisor", "Object Intelligence", "Evidence", "Recommendations", "Confidence", "Validation", "Policy", "Diagnostics", "Explainability"],
    contracts: [
      { level: "MUST", text: "The Advisor MUST explain its recommendations and cite the evidence used." },
      { level: "MUST", text: "The Advisor MUST disclose confidence and MUST NOT mutate objects without explicit authorization." },
      { level: "MUST", text: "All reasoning outputs MUST preserve audit history (constitution & runtime version, policies applied)." },
    ],
  },
  {
    id: "workspace",
    numeral: "Part VI",
    title: "Universal Workspace",
    thesis: "The Workspace is the projection container, not a screen. Only the projection changes.",
    vocabulary: ["Canvas", "Object Intelligence", "Advisor", "Object Activity", "Evidence", "Projection Switcher", "Command Surface", "Selection", "Notifications"],
    contracts: [
      { level: "MUST", text: "The shell (header, navigation, canvas, action bar, context panel) MUST remain stable across hosts; only the projection changes." },
      { level: "SHALL", text: "Every object SHALL be projectable as Table, Timeline, Kanban, Calendar, Graph, Dashboard, Document, or Conversation — the object need not BE a calendar, but MUST be projectable as one." },
      { level: "MUST", text: "Activity MUST be modeled as an Object Activity stream (evolution), not a chronological-only Timeline." },
    ],
  },
];

/** The constitutional stack STD-UX-0001 sits within. */
export const CANON_STACK = [
  { id: "rfc-c0", label: "RFC-C0 — Constitution", role: "Why the platform behaves as it does" },
  { id: "rfc-k0", label: "RFC-K0 — Kernel Responsibilities", role: "What the kernel guarantees" },
  { id: "std-ux", label: "STD-UX-0001 — Interaction Canon", role: "How users operate on objects", current: true },
  { id: "lds", label: "LDS-001 — Visual Language", role: "How it looks" },
  { id: "epr", label: "EOE / EPR — Object Evolution", role: "How objects evolve" },
  { id: "studio", label: "Studio Specifications", role: "Per-object projections" },
  { id: "domain", label: "Domain Packs", role: "Vertical capability bundles" },
  { id: "host", label: "Host Runtimes", role: "Web, Teams, Slack, Outlook, mobile" },
];

/** The canonical Object Evolution lifecycle (Part II/III interaction, not the runtime). */
export const EVOLUTION_LIFECYCLE = [
  "Create", "Acquire Context", "Enrich", "Validate", "Review",
  "Approve", "Execute", "Observe", "Learn", "Evolve",
];
