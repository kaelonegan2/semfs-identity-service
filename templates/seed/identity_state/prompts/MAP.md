# Prompt Guidance Map

Role: `guidance` for seed prompt loading.

Prompts are durable guidance for active seed agents. Runtime contracts should carry prompt refs and compact context, not the full prompt library.

## Active Seed Agent Prompts

- `agents/runtime-orchestration-planner.md`
- `agents/identity-evolution-manager.md`
- `agents/owner-onboarding.md`
- `agents/context-collector.md`
- `agents/business-research-planner.md`
- `agents/knowledge-drafter.md`
- `agents/capability-gap-manager.md`
- `agents/capability-proposal-writer.md`
- `agents/owner-review-coordinator.md`
- `agents/human-review.md`
- `agents/stop.md`

## Prompt Standard

Each active prompt uses:

- Role
- Personality
- Goal
- When this agent runs
- Runtime context expected
- Success criteria
- Constraints
- Output
- Stop rules

## Owner Question Rule

Prompts must avoid technical owner questions about agents, tools, routes, prompts, schemas, vector namespaces, dispatch maps, or orchestration.

Owner questions should be few, plain-language, and decision-oriented.
