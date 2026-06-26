# Deploying to Vercel
1. Import the repo into Vercel.
2. Set environment variables (see `.env.production.example`) — use Vercel's encrypted env, never inline secrets.
3. Build command `npm run build`; output is the default Next.js build.
4. Add `DATABASE_URL` (Postgres) for persistence; omit to run in-memory (not for prod).
5. Set a Vercel **deploy protection** / promotion rule so prod promotions are gated (mirrors Mission Control approval).
6. After deploy, verify `GET /api/health` and `/mission-control/readiness`.
