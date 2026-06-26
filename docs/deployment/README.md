# LAWRENCE Deployment

LAWRENCE is a Next.js 14 (App Router) application. It runs on the in-memory store
for local/dev and on Postgres when `DATABASE_URL` is set (the runtime persists
`rt_*` jsonb document tables; `db/migrations/*.sql` is the canonical reference schema).

## Quick start (local)
```
cp .env.example .env.local
npm install
npm run dev
```

## Production paths
- **Vercel** — see `vercel.md`
- **Docker / self-host** — see `docker.md`
- **Azure App Service** — see `azure-app-service.md`

## Before any deploy
1. `npx tsx scripts/preflight.ts` — validates required env (fails non-zero on missing critical config).
2. `npx tsx scripts/run-migrations.ts` — lists/applies reference migrations when `DATABASE_URL` is set.
3. `GET /api/health` — liveness/readiness probe.
4. Mission Control → **Production Readiness** (`/mission-control/readiness`) — must score ≥ 85.

## Release safety
All promotions go through Mission Control (`build-release-bundle` → approval + eval gate → `promote-release`).
Never bypass the gates. See `rollback.md`.
