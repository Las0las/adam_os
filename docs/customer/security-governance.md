# Security & Governance
- **Tenant isolation**: every record is tenant-scoped by construction (the data-access seam filters by tenant).
- **Permissions**: privileged operations require explicit permissions (`integrations.manage`, `mission_control.admin`, `deploy.promote`, …).
- **Audit**: every state change emits an audit event (installs, syncs, approvals, releases, rollbacks, demos).
- **Approval policies**: prod releases, dangerous actions, rollbacks, kill switches are policy-evaluated and fail-closed.
- **Kill switches**: any function/agent/action/pipeline/integration can be disabled with an audited reason.
- **Release gates**: prod releases block on missing/failed/regressed evals.
- **Eval gates**: quality is measured and regressions are visible before promotion.
- **Secrets**: only credential refs are stored; secret values live in the env/secret manager (`docs/deployment/secrets.md`).
