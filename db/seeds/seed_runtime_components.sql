-- Phase 6 — sample runtime components from the seeded packs, registered against
-- the production environment. Replace :tenant_id at apply time. The runtime
-- installer (mission-control-seed.ts) registers the full set from live
-- definitions; this seed provides a static reference for relational deployments.
insert into runtime_components (tenant_id, component_type, component_key, environment_id, status)
select :tenant_id, c.component_type, c.component_key, e.id, 'enabled'
from environments e
cross join (values
  ('function', 'answer_with_citations'),
  ('function', 'extract_structured_fields'),
  ('function', 'classify_document'),
  ('function', 'generate_draft_response'),
  ('agent',    'shortlist_builder'),
  ('action',   'advance_candidate_stage')
) as c(component_type, component_key)
where e.tenant_id = :tenant_id and e.key = 'prod'
on conflict (tenant_id, component_type, component_key, environment_id) do nothing;
