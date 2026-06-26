# Implementation Overview
A typical LAWRENCE implementation runs ~4 weeks on the real platform — no custom code.

- **Week 0 — Discovery**: pick a domain pack bundle (`src/lib/setup/default-domain-pack-plan.ts`), inventory source systems, confirm data + security requirements (`discovery-checklist.md`, `data-requirements.md`).
- **Week 1 — Tenant bootstrap + integrations**: `POST /api/setup/bootstrap-tenant` creates roles, dev/staging/prod environments, approval policies, eval suites, and installs the bundle. Connect systems in **Settings → Integrations** (credential refs only).
- **Week 2 — Domain pack install + data validation**: run connector syncs; verify objects/evidence in the ontology; review demo flows under `/demos`.
- **Week 3 — Workflow UAT + eval baselines**: run functions/agents; set eval baselines; confirm release eval gates.
- **Week 4 — Go-live + monitoring**: promote through Mission Control; watch `/aiops/observability` and `/mission-control/readiness` (≥ 85). See `go-live-checklist.md`.
