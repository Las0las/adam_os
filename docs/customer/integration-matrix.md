# Integration Matrix
| System | Auth | Data pulled | Objects created | Permissions | Cadence | Failure mode |
|---|---|---|---|---|---|---|
| Microsoft 365 | OAuth (Graph) | mail, calendar, docs | EmailMessage, attachments | integrations.manage | incremental | degraded if creds missing |
| Google Workspace | OAuth | Gmail, Calendar, Drive | EmailMessage | integrations.manage | incremental | degraded if creds missing |
| Slack | OAuth token | channel messages, webhooks | SlackMessage | integrations.manage | incremental + webhook | degraded if creds missing |
| SharePoint/OneDrive | OAuth (Graph) | drive items | KnowledgeDocument | integrations.manage | incremental | degraded if creds missing |
| Greenhouse | API key (Basic) | jobs, candidates | Job, Candidate | integrations.manage | incremental | degraded if creds missing |
| Lever | API key (Basic) | postings, opportunities | Candidate | integrations.manage | incremental | degraded if creds missing |
| Gusto | OAuth/token | employees, onboarding | OnboardingCase | integrations.manage | incremental | degraded if creds missing |
| Custom API | bearer/header | configured list endpoints | configured object type | integrations.manage | incremental | degraded if creds missing |
| Webhook | optional signature | inbound events | per routing config | integrations.manage | push | failed if signature missing |

All connectors are **fail-closed**: missing credentials return `not_configured`/`degraded`, never fake success.
Every sync emits an audit event + runtime trace; repeated failures raise a Mission Control incident.
