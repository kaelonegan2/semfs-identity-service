# Seed Runtime Contract

Role: `runtime-compatibility`.

The runtime contract should carry compact context and validated facets, not the full identity repo.

## Required Contract Shape

- identity id
- lifecycle mode
- trust posture
- inbound summary
- selected route
- selected agent
- output contract id
- allowed tools
- validated facets
- usage event summary
- approval or closeout state

## Active Facets

- `owner_onboarding`
- `context_summary`
- `research_plan`
- `knowledge_draft`
- `capability_gap`
- `capability_proposal`
- `human_review`
- `usage_event`
- `closeout`

## Forbidden Payloads

- full repo contents
- full prompt library
- raw vector records
- raw transcripts
- private audience/account records
- secrets
- credentials
- payment tokens
- private pricing rules

## Hydration

Hydration follows `identity_state/registries/facet-policy.json`.

If a facet would create authority, route to `human_review` instead of treating it as active policy.
