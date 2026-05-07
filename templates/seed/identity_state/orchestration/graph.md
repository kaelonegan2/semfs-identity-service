# Seed Orchestration Graph

Role: `guidance`.

Seed routes:

- `owner_onboarding` -> `owner_onboarding`
- `context_collect` -> `context_collector`
- `clarify_intent` -> `owner_onboarding`
- `research_plan` -> `business_research_planner`
- `knowledge_draft` -> `knowledge_drafter`
- `capability_gap` -> `capability_gap_manager`
- `capability_proposal` -> `capability_proposal_writer`
- `human_review` -> `human_review`
- `stop` -> `stop`

Future external-operation routes are inactive until approved and activated.
