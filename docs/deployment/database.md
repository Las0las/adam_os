# Database
- Set `DATABASE_URL` to enable the Postgres backend. Absent it, the runtime uses an in-memory store (dev/test only).
- Runtime tables are `rt_<collection>` jsonb documents created on demand; tenant scoping is enforced in SQL.
- `db/migrations/000N_*.sql` is the canonical relational reference schema (one pack per phase, through `0014`).
- `db/seeds/*.sql` provide reference seeds; the runtime installers (bootstrap, pack installer) seed via services.
- Apply reference migrations with your migration tool or `npx tsx scripts/run-migrations.ts`.
