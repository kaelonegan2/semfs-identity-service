# Harness Model

The harness model is:

```text
profiles -> stages -> agents
```

## Profiles

Profiles are named stage sequences for a mode of work.

Example future profile: `external_intake` could run classification, context retrieval, intake qualification, draft/review, hydration, upsert, and closeout after approval.

## Stages

Stages are runtime-agnostic work units. A stage may classify inbound work, retrieve repo/vector context, plan a route, dispatch an agent, prepare an internal packet, request review, hydrate facets, upsert learning, or close the run.

## Agents

Agents are registered executable surfaces. Each agent defines:

- id,
- class,
- runtime implementation surface,
- prompt source,
- allowed tools,
- output contract,
- facet behavior.

## Adapter Note

A runtime can implement this model as workflows, worker steps, queue stages, or local function calls. Adapter-specific mappings belong in `.runtime/adapters/`, not in the identity operating model.
