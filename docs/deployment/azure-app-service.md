# Azure App Service
1. Create a Linux App Service (Node 20) or deploy the Docker image to Azure Container Apps.
2. Configure App Settings from `.env.production.example`; store secrets in Azure Key Vault and reference them.
3. Point `DATABASE_URL` at Azure Database for PostgreSQL.
4. Set the health check path to `/api/health`.
5. Use deployment slots (staging → prod) and gate the swap behind Mission Control approval.
