# Human Review Packet

Role: `guidance` for review artifacts.

A human review packet should make the decision easy to approve, reject, or revise.

Runtime-created packets should conform to `human-review-packet.schema.json`. Approval/rejection/change/expiry results should conform to `approval-results.schema.json` and resume according to `human-review-result-resume.md`.

## Required Sections

- Conversation or run id.
- Requested action.
- Approval type.
- Required role.
- Current trust assertion summary.
- Lifecycle mode.
- Draft or proposed artifact.
- Known facts.
- Assumptions.
- Risks.
- Relevant repo refs.
- Relevant vector refs.
- Usage summary for the run.
- Recommended next route after approval.
- Expiration or review deadline if applicable.

## Do Not Include

- Raw PII unless the review surface is authorized for it.
- Secrets, tokens, hidden routing rules, or verification algorithms.
- Full vector records.
- Full prompt or registry dumps.

## Approval Results

Approval results should return as structured runtime data matching `approval-results.schema.json`.
