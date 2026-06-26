-- Phase 7 — sample eval cases bound to suites (via metadata.suiteKey at runtime;
-- this reference seed binds by suite_type). Replace :tenant_id at apply time.
insert into eval_cases (tenant_id, suite_type, input, expected, metadata) values
  (:tenant_id, 'retrieval',
    '{"query":"candidate has Power BI Fabric healthcare experience","methods":["rank_fusion"]}'::jsonb,
    '{"expectedObjectRefs":[]}'::jsonb,
    '{"suiteKey":"recruiting_candidate_fit_retrieval_eval"}'::jsonb),
  (:tenant_id, 'retrieval',
    '{"query":"VPN setup instructions","methods":["rank_fusion"]}'::jsonb,
    '{"expectedObjectRefs":[]}'::jsonb,
    '{"suiteKey":"support_answer_retrieval_eval"}'::jsonb),
  (:tenant_id, 'extraction',
    '{"functionKey":"extract_structured_fields"}'::jsonb,
    '{"fields":{"claimAmount":"","invoiceDate":"","policyNumber":""}}'::jsonb,
    '{"suiteKey":"claims_extraction_eval"}'::jsonb),
  (:tenant_id, 'response',
    '{"functionKey":"answer_with_citations","question":"What are the account risks?"}'::jsonb,
    '{"requiredFacts":["margin risk","delivery risk"],"forbiddenClaims":["guaranteed"]}'::jsonb,
    '{"suiteKey":"executive_risk_response_eval"}'::jsonb),
  (:tenant_id, 'recommendation',
    '{"functionKey":"recommend_next_action"}'::jsonb,
    '{"expectedActionKeys":["notify_owner","create_task"]}'::jsonb,
    '{"suiteKey":"onboarding_recommendation_eval"}'::jsonb);
