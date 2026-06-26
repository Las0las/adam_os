-- Phase 7 — demo learning data: one open high-severity learning signal so the
-- learning queue + Command Center risk queue have content. Replace :tenant_id.
insert into learning_signals (tenant_id, signal_type, component_type, component_key, domain, severity, summary, evidence, recommended_change, status) values
  (:tenant_id, 'retrieval_gap', 'function', 'answer_with_citations', 'support', 'high',
    'Expected knowledge chunk not retrieved for VPN setup query',
    '[{"evalSuiteKey":"support_answer_retrieval_eval"}]'::jsonb,
    '{"kind":"improve_retrieval_strategy"}'::jsonb,
    'open')
on conflict do nothing;
