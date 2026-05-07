# Governance Map

Role: `authoritative` governance traversal map.

`identity_state/governance/` defines usage policy, budget classes, event expectations, and example rollups. The runtime measures usage; the repo defines policy and reporting expectations.

[Namespace: usage-rollups | Purpose: cumulative usage summaries by conversation, agent, role, tool, and identity | Retrieval: when reviewing budget posture]

[Namespace: budget-threshold-events | Purpose: prior budget warnings, approvals, downgrades, or stops | Retrieval: when threshold status affects routing]

## Read First

1. `usage-policy.md`
2. `usage-budgets.json`
3. `model-selection.md`
4. `model-classes.json`
5. `model-usage-policy.md`
6. `usage-rollup.example.json`
7. `usage-ledger.example.jsonl`

## Authoritative Files

- `usage-budgets.json`: machine-readable budget classes, thresholds, and threshold behavior.
- `model-classes.json`: model class definitions and agent recommendations.

## Examples

- `usage-ledger.example.jsonl`: example usage events.
- `usage-rollup.example.json`: example cumulative totals.

## Runtime Rule

The runtime emits usage events. The identity repo does not count tokens directly. Agents should consume usage summaries and threshold statuses, not raw billing internals.

Model classes are portable categories. The runtime maps them to actual vendor/model choices.
