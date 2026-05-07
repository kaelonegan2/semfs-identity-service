# Authority Map

Role: `authoritative` authority traversal map.

`identity_state/authority/` defines human escalation, approval roles, review packets, and safe ownership verification. It configures roles and required assertions; it does not store secrets or verification mechanisms.

[Namespace: identity-authority-legend]

[Namespace: human-review-history | Purpose: prior human review outcomes and escalation summaries | Retrieval: when preparing review packets]

## Read First

1. `roles.md`
2. `escalation-matrix.json`
3. `escalation-matrix.md`
4. `human-review-packet.md`
5. `human-review-packet.schema.json`
6. `approval-results.schema.json`
7. `human-review-result-resume.md`
8. `ownership-verification.md`

## Authoritative Files

- `escalation-matrix.json`: machine-readable approval routing.
- `approval-results.schema.json`: expected shape for runtime approval results.
- `human-review-packet.schema.json`: expected shape for review packets.

## Guidance Files

- `roles.md`: human role definitions and approval boundaries.
- `escalation-matrix.md`: human-readable matrix.
- `human-review-packet.md`: packet contents for review.
- `human-review-result-resume.md`: how approval results resume routing.
- `ownership-verification.md`: safe trust assertion model.

## Runtime Rule

The runtime verifies humans externally and writes opaque trust/approval assertions into the contract. Agents consume those assertions; they never see secrets, tokens, hidden routing rules, or verification algorithms.
