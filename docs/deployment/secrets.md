# Secrets handling
- The database stores only a **credentialRef** (an env var name / secret-manager key) for integrations — never a secret value.
- `src/lib/integrations/credential-service.ts` resolves refs from `process.env`; secrets are never logged or returned by the API.
- Model/provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are read fail-closed; missing keys degrade to the deterministic mock (with `LAWRENCE_ALLOW_MOCK_MODEL=1`), never silent substitution.
- Config export (`/api/setup/export-config`) emits credential ref *names* only — no secret values leave the environment.
- Rotate secrets in your secret manager; refs in the DB are stable across rotations.
