# Admin Training
- Bootstrap a tenant: `POST /api/setup/bootstrap-tenant` (or `scripts/bootstrap-tenant.ts`).
- Manage integrations: **Settings → Integrations** — create connections with credential refs, test, run syncs, view sync history + webhooks.
- Mission Control: environments, releases, approvals, rollbacks, kill switches, runtime health, production readiness.
- Governance: approval policies, audit trail, release + eval gates.
- Config export/import for promotion between tenants/environments (no secrets).
