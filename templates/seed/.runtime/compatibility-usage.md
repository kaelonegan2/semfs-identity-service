# Runtime Usage Compatibility

Role: `runtime-compatibility` usage guidance.

The identity repo defines usage budgets and reporting expectations. The runtime measures usage and emits events.

## Runtime Must Emit

- Model call events with input/output token estimates.
- Tool call events.
- Vector retrieval and upsert attempt events.
- Repo write attempt events.
- Workflow/runtime call events.
- Outbound send attempt events.
- Human review and approval result events.
- Cost estimate when available.

## Runtime Must Roll Up

Usage should be reportable by conversation, run, agent, route, stage, role, tool, day, month, and identity.

## Runtime Must Enforce

Threshold behavior from `identity_state/governance/usage-budgets.json`.

If a threshold requires approval, the runtime sets usage status in the contract and routes to `human_review` or `stop`.

## Runtime Should Not Do

Do not ask agents to count tokens directly. Do not inject full ledgers into normal agent input. Provide compact usage summaries and threshold statuses.
