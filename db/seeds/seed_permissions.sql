-- Seed the global permission catalog (§47.2 + Phase 2 §57).
insert into permissions (key, name, description) values
  ('dataops.admin',                  'DataOps Admin',            'Manage sources, ingestion, pipelines'),
  ('dataops.pipeline_run',           'Run Pipelines',            'Execute pipeline runs'),
  ('ontology.admin',                 'Ontology Admin',           'Manage object/link types and schemas'),
  ('ontology.write',                 'Ontology Write',           'Upsert ontology objects and links'),
  ('aiops.function_admin',           'Function Admin',           'Create and edit AI functions'),
  ('aiops.function_run',             'Run Functions',            'Execute AI functions'),
  ('aiops.agent_admin',              'Agent Admin',              'Create and edit agents'),
  ('mission_control.admin',          'Mission Control Admin',    'Manage releases, policies, runtime'),
  ('mission_control.action_execute', 'Execute Actions',          'Execute mission-control actions'),
  ('review.reviewer',                'Reviewer',                 'Resolve review cases'),
  ('deploy.promote',                 'Promote Deployments',      'Promote and roll back releases'),
  ('notifications.manage',           'Manage Notifications',     'Manage notification rules and templates')
on conflict (key) do nothing;
