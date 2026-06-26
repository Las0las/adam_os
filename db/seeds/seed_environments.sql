-- Phase 6 — default deployment environments. Replace :tenant_id at apply time.
insert into environments (tenant_id, key, name, environment_type, status, config) values
  (:tenant_id, 'dev',     'Development', 'dev',     'active', '{}'::jsonb),
  (:tenant_id, 'staging', 'Staging',     'staging', 'active', '{}'::jsonb),
  (:tenant_id, 'prod',    'Production',  'prod',    'active', '{}'::jsonb)
on conflict (tenant_id, key) do nothing;
