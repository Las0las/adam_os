-- Seed default model definitions (§32, §57). Tenant id is bound at apply time;
-- replace :tenant_id with the target tenant when running.
insert into model_definitions (tenant_id, key, provider, model_key, purpose, config, status) values
  (:tenant_id, 'chat-primary',       'anthropic', 'claude-sonnet',          'chat',           '{}'::jsonb, 'active'),
  (:tenant_id, 'extraction-primary', 'openai',    'gpt-4.1-mini',           'extraction',     '{}'::jsonb, 'active'),
  (:tenant_id, 'embedding-primary',  'openai',    'text-embedding-3-large', 'embedding',      '{}'::jsonb, 'active')
on conflict (tenant_id, key) do nothing;
