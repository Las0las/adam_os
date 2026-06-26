# Docker / self-host
```
docker compose up --build
```
Services: `app` (Next.js, non-root, healthcheck on `/api/health`) and `postgres`.
Optional MinIO is commented in `docker-compose.yml` for object storage.

Standalone:
```
docker build -t lawrence .
docker run -p 3000:3000 --env-file .env.local lawrence
```
The image runs as a non-root user and declares a `HEALTHCHECK` against `/api/health`.
