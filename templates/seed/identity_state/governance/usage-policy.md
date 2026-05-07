# Usage Policy

Role: `authoritative` usage governance guidance.

Mid-state autonomous work must be budgeted and reported across conversations, agents, roles, tools, and the identity as a whole.

[Namespace: usage-events | Purpose: runtime-emitted model/tool/vector/outbound/review usage events | Retrieval: runtime-only or summarized rollup preparation]

[Namespace: usage-rollups | Purpose: compact usage summaries for agents and human review | Retrieval: when budget context is needed]

## Runtime Responsibilities

The runtime must emit usage events for:

- model calls,
- input token estimates,
- output token estimates,
- tool calls,
- vector retrieval calls,
- vector upsert attempts,
- repo write attempts,
- workflow/runtime calls,
- outbound send attempts,
- human review events,
- approval results,
- cost estimates when available.

## Tracking Dimensions

Usage should be rollable by:

- conversation id,
- run id,
- agent id,
- route,
- stage,
- role,
- tool id,
- day,
- month,
- identity id.

## Budget Behavior

Threshold behavior may include:

- `continue`: remain within normal budget.
- `warn`: record warning and include in closeout.
- `require_approval`: route to `human_review` before nonessential work.
- `downgrade_model`: use a cheaper/lower-context model if runtime supports it.
- `stop_nonessential_work`: finish only required review/closeout.
- `escalate_to_owner`: owner review required.

## Mid-State Defaults

Mid-state identity behavior should:

- prefer compact inputs over full repo injection,
- retrieve only minimal vector context,
- avoid repeated route loops,
- stop nonessential work when budget thresholds are exceeded,
- include usage summary in human review packets and closeout.

## Budget Exceeded

If a conversation, agent, role, or identity-level threshold is exceeded, the runtime should set a usage threshold status in the contract and route to `human_review` or `stop` according to `usage-budgets.json`.
