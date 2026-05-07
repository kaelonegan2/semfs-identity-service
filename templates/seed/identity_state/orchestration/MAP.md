# Orchestration Map

Role: `authoritative` seed orchestration map.

Read:

1. `dispatch-map.json`
2. `seed-decision-path.md`
3. `seed-stage-plan.md`
4. `stages.json`
5. `graph.json`

Seed dispatch uses `decision.routing.next`.

The runtime should block routes that are not listed in `dispatch-map.json`.
