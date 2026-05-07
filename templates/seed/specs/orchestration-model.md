# Seed Orchestration Model

Role: `runtime-compatibility`.

Seed orchestration routes by `decision.routing.next`.

Active routes:

- `owner_onboarding`
- `context_collect`
- `clarify_intent`
- `research_plan`
- `knowledge_draft`
- `capability_gap`
- `capability_proposal`
- `human_review`
- `stop`

The runtime compiles compact planner input, selects a seed route, resolves the agent/prompt/output contract from registries, validates the returned facet, hydrates the runtime contract, writes safe artifacts, and routes authority-bearing actions to review.

Mature external-operation routes are inactive future capabilities.
