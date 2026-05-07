# Agent Model

Agents are named registered responsibilities, not arbitrary runtime inventions.

## Agent Types

- Internal agents: project-owned planning, review, and closeout surfaces.
- Runtime template agents: reusable business-work surfaces supplied by the runtime.
- Identity-evolved agents: candidate agents proposed, approved, activated, then registered.

## Required Agent Metadata

- `id`
- `class`
- `status`
- `prompt_ref`
- `tools`
- `output_contract`

## Agent Lifecycle

Active operational agent evolution lives in `identity_state/agents/`.

The registry decides dispatchability; lifecycle files explain why an agent exists, what gap it addresses, and what is required before activation.

Owner-authorized evolution agents live in `identity_state/operating_model/evolution-agents.*`. They are not normal external-operation dispatch agents; they manage proposals, review packets, and activation plans.

## Agent Output

Every agent output should include:

- task result,
- route recommendation or final state,
- structured facets,
- audit notes,
- repo/vector upsert recommendation when learning occurred.

## Dynamic Agent Constraint

If a new agent seems useful, write an agent proposal. Do not create an unregistered runtime agent as the normal path.
