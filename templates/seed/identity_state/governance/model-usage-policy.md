# Model Usage Policy

Role: `guidance` for model class and budget behavior.

## Runtime Responsibility

The runtime maps model classes to actual models, measures usage, and applies budget thresholds.

## Budget Interaction

- `low_cost_fast`: default for simple routing and status work.
- `standard_reasoning`: default for most external-facing drafts and knowledge curation.
- `high_reasoning`: requires stronger justification and should be visible in usage summaries.
- `code_or_tool_builder`: used for tool/spec/schema design, not normal external replies.
- `review_grade`: used for policy-sensitive review and final human review packets.

## Threshold Behavior

If budget status is `warn`, include model usage in closeout. If `require_approval`, route nonessential high-reasoning work to human review. If `escalate_to_owner`, stop nonessential work.
