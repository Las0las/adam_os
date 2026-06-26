# Observability
- **Runtime traces** are emitted for pipeline/function/agent/action/notification/release/integration runs (`src/lib/aiops/observability`).
- **AI usage** (provider/model/latency/cost) is recorded per model call.
- **Overview**: `/aiops/observability` (or `GET /api/aiops/observability/overview`) — cost/latency/failure/quality + top failing/costly/slow runs.
- **Failure thresholds** raise Mission Control incidents (3/15m = high, 5 = critical), deduped per component.
- **Health**: `GET /api/health` (deploy probe) and Mission Control runtime health.
