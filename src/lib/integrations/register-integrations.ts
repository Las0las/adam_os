// Phase 9 — integration adapter registration. Importing this module registers
// every connector adapter. Bootstrap imports it so the registry is populated.

import { registerIntegrationAdapter } from "./integration-registry";
import { microsoft365Adapter } from "./adapters/microsoft365-adapter";
import { googleWorkspaceAdapter } from "./adapters/google-workspace-adapter";
import { slackAdapter } from "./adapters/slack-adapter";
import { sharepointAdapter } from "./adapters/sharepoint-adapter";
import { greenhouseAdapter } from "./adapters/greenhouse-adapter";
import { leverAdapter } from "./adapters/lever-adapter";
import { gustoAdapter } from "./adapters/gusto-adapter";
import { customApiAdapter } from "./adapters/custom-api-adapter";
import { webhookAdapter } from "./adapters/webhook-adapter";

for (const adapter of [
  microsoft365Adapter,
  googleWorkspaceAdapter,
  slackAdapter,
  sharepointAdapter,
  greenhouseAdapter,
  leverAdapter,
  gustoAdapter,
  customApiAdapter,
  webhookAdapter,
]) {
  registerIntegrationAdapter(adapter);
}

// OneDrive shares the SharePoint (Graph drives) adapter under its own provider.
registerIntegrationAdapter({ ...sharepointAdapter, provider: "one_drive" });
