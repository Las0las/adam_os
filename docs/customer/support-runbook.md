# Support Runbook
- **Integration failing**: Settings → Integrations → connection → test; check sync history + Mission Control incident; verify credential ref present in env.
- **AI answer ungrounded**: capture "bad citation" feedback; check eval suite; review knowledge gaps.
- **Release blocked**: check eval gate status on the release; run the suite; fix regression or get approval.
- **Need to stop a component**: enable a kill switch (audited reason) in Mission Control.
- **Roll back**: `docs/deployment/rollback.md`.
- **Health**: `GET /api/health`, `/mission-control/readiness`, `/aiops/observability`.
