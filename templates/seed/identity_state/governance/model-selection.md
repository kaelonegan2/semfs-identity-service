# Model Selection

Role: `authoritative` model-selection guidance.

The identity selects model classes, not hard dependencies on a vendor. The runtime maps classes to available models.

[Namespace: model-selection-decisions | Purpose: prior model-class choices, fallback events, and budget-driven changes | Retrieval: when changing model policy or reviewing complex orchestration]

## Principles

- Use the smallest capable model class.
- Escalate model class for high-risk synthesis, policy conflict, research, or tool/spec design.
- Tie model choice to usage budget and review risk.
- If a budget threshold is exceeded, the runtime may downgrade model class or stop nonessential work according to usage policy.

## Active Agent Defaults

Operational agents should follow model class recommendations in `model-classes.json` and `identity_state/operating_model/agent-contracts.json`.

Evolution agents use higher reasoning or tool-builder classes because they design capability, not just draft external replies.
