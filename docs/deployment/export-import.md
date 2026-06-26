# Config export / import
- `POST /api/setup/export-config` → tenant config **without secrets** (packs, integration shells with ref names, approval policies, model definitions metadata, eval suite metadata, environments).
- `POST /api/setup/import-config` with `{ config, apply: false }` → dry-run validation; `apply: true` (admin) recreates environments, approval policies, and integration connection shells. Emits `setup.config_imported` audit.
- Secrets are never exported or imported — only credential ref names.
