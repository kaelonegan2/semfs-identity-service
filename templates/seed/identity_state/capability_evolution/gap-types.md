# Capability Gap Types

Role: `authoritative` gap taxonomy.

When an agent cannot proceed because the identity lacks something, it should return `capability_gap_detected` or a more specific blocking status and create a gap record.

## Runtime Semantics

- `facets.capability_gap`: emitted by any active operational agent when a gap is detected.
- `capability_gap` stage: records the gap during normal operations and decides whether to close, review, or request owner-authorized evolution.
- `decision.evolution.next = resolve_capability_gap`: owner-authorized evolution route for managing a recorded gap.

Do not add `decision.routing.next = capability_gap` to normal dispatch unless a future approved runtime explicitly introduces that route and registers an operational agent for it.

## Gap Types

### `missing_tool`

A needed runtime tool is not available or not active.

Record in: `identity_state/capability_evolution/gaps.md`

Artifact: gap record; optional tool proposal.

Reviewer: `identity_owner` if activation or new authority is requested.

### `missing_tool_schema`

A tool exists conceptually, but the runtime lacks a contract/schema needed for safe use.

Artifact: gap record and schema proposal.

Reviewer: `identity_owner` or runtime maintainer.

### `missing_specialist`

A specialist surface would improve quality or safety, but no active specialist exists.

Artifact: gap record and specialist proposal.

Reviewer: `identity_owner`.

### `missing_prompt_guidance`

An active or proposed capability lacks prompt guidance.

Artifact: prompt proposal.

Reviewer: `identity_owner` for activation.

### `missing_playbook`

The business workflow is not defined enough for safe autonomous work.

Artifact: playbook proposal.

Reviewer: `operations_admin`; owner if authority changes.

### `missing_authority`

The action might be useful, but no role/policy grants authority.

Artifact: human review packet and authority proposal if needed.

Reviewer: `identity_owner`.

### `missing_private_context`

The needed audience, account, customer, property, project, preference, or relationship facts are absent or inaccessible.

Artifact: missing-context facet or clarification draft.

Reviewer: usually no owner approval; route to `clarify_intent` or ask for context.

### `missing_offering_definition`

The inbound request asks about an offering, service, function, or boundary that is not clearly defined as fit or non-fit.

Artifact: offering-definition gap and proposed catalog/playbook update.

Reviewer: `identity_owner`.

### `missing_pricing_policy`

Pricing context or approval path is insufficient.

Artifact: estimate review packet and pricing-policy gap.

Reviewer: `estimator` for estimate, `identity_owner` for policy.

### `missing_credential_binding`

A tool or integration requires a credential alias that has not been approved or runtime-bound.

Artifact: credential request.

Reviewer: `identity_owner` or delegated operations admin when policy allows.

### `missing_payment_capability`

A workflow requires deposits, estimate fees, invoices, or 402-style payment-required behavior that is not configured.

Artifact: payment capability proposal and compliance review packet.

Reviewer: `identity_owner`.

### `missing_model_policy`

The runtime lacks a model-class mapping or budget policy for the requested work.

Artifact: model-selection policy proposal.

Reviewer: `identity_owner` for policy, operations admin for low-risk model mapping.

## Activation Rule

Gap records and proposals are not active capabilities. Activation requires approval, updated prompt/registry/contract/facet/tool files as applicable, and eval coverage.
