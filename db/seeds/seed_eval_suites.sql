-- Phase 7 — default eval suites per domain. Replace :tenant_id at apply time.
insert into eval_suites (tenant_id, key, name, suite_type, status, target_component_type, target_component_key, baseline_config) values
  (:tenant_id, 'recruiting_candidate_fit_retrieval_eval', 'Recruiting candidate fit retrieval', 'retrieval',      'active', 'function', 'answer_with_citations',   '{"averageScore":0.5}'::jsonb),
  (:tenant_id, 'support_answer_retrieval_eval',           'Support answer retrieval',           'retrieval',      'active', 'function', 'answer_with_citations',   '{"averageScore":0.5}'::jsonb),
  (:tenant_id, 'claims_extraction_eval',                  'Claims extraction',                  'extraction',     'active', 'function', 'extract_structured_fields','{"averageScore":0.7}'::jsonb),
  (:tenant_id, 'executive_risk_response_eval',            'Executive risk response',            'response',       'active', 'function', 'answer_with_citations',   '{"averageScore":0.6}'::jsonb),
  (:tenant_id, 'onboarding_recommendation_eval',          'Onboarding recommendation',          'recommendation', 'active', 'function', 'recommend_next_action',   '{"averageScore":0.6}'::jsonb)
on conflict (tenant_id, key) do nothing;
