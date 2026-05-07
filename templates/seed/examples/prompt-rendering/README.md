# Rendered Prompt Examples

Role: `example`.

These examples show compact runtime prompt rendering. They are not executable workflows and do not add capabilities.

## Runtime Orchestration Planner

Rendered context:

```text
contract.ctx.identity_id = solo-identity-seed
contract.ctx.conversation_id = conv-001
contract.msg.summary = Verified owner asks what this identity should do.
contract.decision.routing.next = unknown
contract.orchestration.stage = planner
contract.facets.context_summary = none
contract.facets.capability_gap = none
prep.identity.lifecycle_mode = seed_runtime_available
prep.identity.readiness_score = 0.18
prep.identity.known_profile_summary = Purpose/domain/offers/audience unknown.
prep.authority.owner_verified = true
prep.authority.trust_level = verified_owner
prep.vector_context.allowed_summaries = []
prep.available_tools = [repo_read, structured_output_validate, facet_hydrate, usage_event_emit]
prep.output_contract = planner_decision
```

Expected output:

```text
decision.routing.next = owner_onboarding
orchestration.stage_plan = verify owner, explain recommended seed path, collect one decision
orchestration.selected_agent = owner_onboarding
trust.posture = verified_owner
expected facet target = owner_onboarding
```

## Owner Onboarding

Rendered context:

```text
contract.msg.summary = Owner asks what this identity should do.
contract.facets.owner_onboarding = none
contract.facets.context_summary = none
prep.identity.known_profile_summary = Fresh seed; domain and purpose unknown.
prep.authority.owner_verified = true
prep.available_tools = [repo_read, conversation_artifact_write]
prep.output_contract = owner_onboarding
```

Expected output/facet:

```text
facets.owner_onboarding.recommendation = Start with purpose/profile discovery and draft-only knowledge.
facets.owner_onboarding.decision_needed = Confirm this first maturation focus.
facets.owner_onboarding.safe_default = Continue with internal drafts only.
decision.routing.next = context_collect
```

## Context Collector

Rendered context:

```text
contract.msg.summary = Owner wants help running a small business but does not know where to start.
contract.facets.owner_onboarding.recommendation = Start with purpose/profile discovery.
prep.authority.owner_verified = true
prep.vector_context.allowed_summaries = []
prep.available_tools = [repo_read, conversation_artifact_write, semfs_vector_upsert]
prep.output_contract = context_summary
```

Expected output/facet:

```text
facets.context_summary.known_facts = Owner wants small-business operating help.
facets.context_summary.assumptions = Business/domain/offers are not yet confirmed.
facets.context_summary.unknowns = purpose, audience, offering, authority limits, tone.
facets.vector_upsert.namespace = identity-profile-history
decision.routing.next = research_plan
```

## Business Research Planner

Rendered context:

```text
contract.facets.context_summary.known_facts = Owner wants small-business operating help.
prep.available_tools = [repo_read, repo_write_proposal, semfs_vector_retrieve, semfs_vector_upsert]
prep.vector_context.allowed_summaries = [{namespace: identity-profile-history, summary: "Small-business help desired; domain unknown."}]
prep.output_contract = research_plan
```

Expected output/facet:

```text
facets.research_plan.objective = Identify domain, audience, likely offerings, and common questions once owner gives a hint.
facets.research_plan.public_questions = general small-business operating needs; domain-specific research deferred.
facets.research_plan.owner_decisions = Confirm business/function direction.
decision.routing.next = knowledge_draft
```

## Knowledge Drafter

Rendered context:

```text
contract.facets.context_summary.known_facts = Owner wants small-business operating help.
contract.facets.research_plan.objective = Prepare neutral setup knowledge.
prep.vector_context.allowed_summaries = [{namespace: research-summary-drafts, summary: "No domain evidence yet; keep FAQ neutral."}]
prep.available_tools = [repo_read, repo_write_proposal, semfs_vector_retrieve, semfs_vector_upsert]
prep.output_contract = knowledge_draft
```

Expected output/facet:

```text
facets.knowledge_draft.items = draft FAQ candidates about purpose, intake, approvals, external sends, pricing, and research.
facets.knowledge_draft.review_status = draft_pending_owner_review
decision.routing.next = capability_gap
```

## Capability Gap Manager

Rendered context:

```text
contract.msg.summary = Runtime detected intake/lead handling would be useful but inactive.
contract.facets.context_summary.unknowns = audience, offering catalog, commitment policy.
prep.available_tools = [repo_read, repo_write_proposal, capability_gap_record, semfs_vector_upsert]
prep.output_contract = capability_gap
```

Expected output/facet:

```text
facets.capability_gap.gap = Lead or intake qualification is not active.
facets.capability_gap.blocked_action = Qualifying external requests.
facets.capability_gap.safe_default = Route external requests to human_review.
decision.routing.next = capability_proposal
```

## Capability Proposal Writer

Rendered context:

```text
contract.facets.capability_gap.gap = Lead or intake qualification is not active.
prep.authority.owner_verified = true
prep.available_tools = [repo_read, repo_write_proposal, capability_proposal_create, human_review_packet_create]
prep.output_contract = capability_proposal
```

Expected output/facet:

```text
facets.capability_proposal.name = lead_or_intake_qualification
facets.capability_proposal.status = proposed_inactive
facets.capability_proposal.owner_approval_question = I recommend preparing intake as draft-only first. Should I prepare the activation checklist?
decision.routing.next = human_review
```

## Human Review

Rendered context:

```text
contract.msg.summary = Non-owner asks for a quote before maturity.
contract.facets.capability_gap = quote/pricing workflow inactive
prep.authority.owner_verified = false
prep.authority.trust_level = unverified_external
prep.available_tools = [repo_read, human_review_packet_create, usage_event_emit]
prep.output_contract = human_review
```

Expected output/facet:

```text
facets.human_review.summary = Quote request received before pricing or external response authority exists.
facets.human_review.decision_needed = Human decides whether and how to respond.
facets.human_review.safe_default = Do not quote or commit.
decision.routing.next = stop
```
