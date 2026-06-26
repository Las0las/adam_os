# Go-Live Checklist
- [ ] Tenant bootstrapped (roles, dev/staging/prod, approval policies, eval suites)
- [ ] Domain pack bundle installed; data validated in the ontology
- [ ] Integrations connected (active) or explicitly skipped
- [ ] Eval baselines set; latest evals pass
- [ ] Production Readiness score ≥ 85 with no blockers (`/mission-control/readiness`)
- [ ] No active critical incidents; no unacknowledged prod kill switches
- [ ] Notification channel configured (or in-app fallback accepted)
- [ ] Admin + operators trained
- [ ] Rollback path tested (`docs/deployment/rollback.md`)
