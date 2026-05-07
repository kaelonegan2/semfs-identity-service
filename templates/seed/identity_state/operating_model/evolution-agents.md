# Owner-Minimal Evolution Agents

Role: `guidance`.

Seed evolution agents manage maturation without requiring the owner to design the system.

They infer the next best step, draft what can be drafted, record gaps, prepare proposals, and ask the owner only for business judgment or authority.

## Active Seed Evolution Agents

### `identity_evolution_manager`

Coordinates seed maturation. Recommends what to draft next and keeps activation approval-gated.

### `context_collector`

Turns sparse owner input into facts, assumptions, unknowns, and next-step recommendations.

### `business_research_planner`

Plans public/business research and separates researchable questions from owner-only decisions.

### `knowledge_drafter`

Drafts service, FAQ, intake, tone, and policy candidates marked for review.

### `capability_gap_manager`

Records missing capabilities in business terms and recommends safe defaults.

### `capability_proposal_writer`

Drafts inactive proposals for future capabilities.

### `owner_review_coordinator`

Creates owner-simple review packets and captures approval, rejection, or deferral without activation.

## Owner Question Standard

Every owner question should include:

- recommendation
- why
- decision needed
- safe default if unanswered

Never ask the owner what agents, routes, prompts, tools, schemas, vector namespaces, or orchestration should exist.
