# Operating Model Map

Role: `guidance` for runtime-facing operating semantics.

This directory explains what the identity is designed to produce, what it can do, how much authority it has, and which agent surfaces exist.

## Read First

1. `outcomes.md`
2. `authority.md`
3. `capabilities.md`
4. `routing_preferences.md`
5. `agent-contracts.md`
6. `evolution-agents.md`
7. `agents.md`

## Files

- `outcomes.md`: durable outcomes the identity should optimize for. Guidance.
- `authority.md`: what the identity can change, propose, or never do. Guidance mirror of canonical authority.
- `capabilities.md`: current capability surface. Guidance.
- `agents.md`: human-readable agent taxonomy and responsibilities. Guidance.
- `agent-contracts.md`: human-readable operating contracts for active agents. Guidance.
- `agent-contracts.json`: machine-readable operating contracts for active agents.
- `evolution-agents.md`: owner-authorized agents for identity maturation. Guidance.
- `evolution-agents.json`: machine-readable evolution-agent surface; not normal dispatch.
- `agents.json`: parseable operating-model mirror for agent categories. Machine-readable guidance.
- `routing_preferences.md`: route selection guidance. Guidance; dispatch truth remains `orchestration/dispatch-map.json`.

## Runtime Use

A runtime should read these files during prep, compile only relevant excerpts into `planner_input` or `agent_input`, and keep the runtime contract small.
