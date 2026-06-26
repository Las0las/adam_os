# Rollback
Rollbacks are governed by Mission Control — they require a reason and approval.
```
npx tsx scripts/rollback-release.ts <releaseId> "<reason>"
```
This creates a rollback record (status `pending_approval`); an admin approves it
(`/api/mission-control/approvals/[id]/approve`), then `executeRollback` reverses
the release items against runtime components. Failures raise a critical incident.
Never delete or mutate production state directly.
