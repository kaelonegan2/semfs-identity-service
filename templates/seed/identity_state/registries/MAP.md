# Registries Map

Role: `authoritative` registry map.

Seed dispatchability comes from:

- `identity_state/orchestration/dispatch-map.json`
- `identity_state/registries/agents.json`
- `identity_state/registries/tools.json`
- `identity_state/registries/tool-aliases.json`
- `identity_state/registries/output-contracts.json`
- `identity_state/registries/facet-policy.json`

Only agents with `status = active` in the seed registry may be selected by `decision.routing.next`.

Tool aliases normalize older or matured-branch terminology into canonical seed tool ids. Aliases do not grant authority; runtime permission still comes from `tools.json` and the selected agent registry entry.

Mature external-operation routes and agents are inactive future references.
