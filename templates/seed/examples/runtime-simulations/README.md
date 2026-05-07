# Runtime Simulations

Role: `example`.

These are end-to-end proof traces for a compatible runtime. They are not executable workflows.

## Scenario 1: Verified Owner Asks "What Should This Identity Do?"

Input runtime contract excerpt:

```text
ctx.identity_id = solo-identity-seed
msg.summary = Verified owner asks what this identity should do.
authority.owner_verified = true
lifecycle_mode = seed_runtime_available
facets = {}
```

Compiled `planner_input`: lifecycle, owner trust, readiness 0.18, active routes, empty vector summaries, planner contract.

Rendered planner prompt excerpt: choose an active route; prefer safe maturation; no technical owner questions.

Expected planner output:

```text
decision.routing.next = owner_onboarding
stage_plan = explain recommended seed path, ask one high-leverage decision, prepare context collection
selected_agent = owner_onboarding
```

Selected agent: `owner_onboarding`.

Compiled `agent_input`: owner question, seed unknowns, approval boundaries, tools `repo_read` and `conversation_artifact_write`.

Rendered agent prompt excerpt: recommend first maturation focus; ask at most two plain-language questions.

Expected agent output/facet:

```text
facets.owner_onboarding.recommendation = Start with identity purpose, profile assumptions, audience/offering discovery, and draft-only knowledge.
facets.owner_onboarding.decision_needed = Confirm this first focus.
facets.owner_onboarding.safe_default = Proceed with internal drafts only.
decision.routing.next = context_collect
```

Contract hydration summary: hydrate `facets.owner_onboarding`.

Repo artifact writeback: conversation current-status records recommended first focus.

Vector upsert summary: optional `owner-onboarding-summaries` with setup preference summary.

Usage event summary: route `owner_onboarding`, agent `owner_onboarding`, tools used.

Final route or stop condition: next route `context_collect`.

## Scenario 2: Owner Gives Vague Context

Input runtime contract excerpt:

```text
msg.summary = Owner says: "I want this to help me run a small business, but I don't know where to start."
authority.owner_verified = true
facets.owner_onboarding.recommendation = Start with purpose/profile discovery.
```

Compiled `planner_input`: verified owner, vague business context, no domain profile, context collection contract.

Rendered planner prompt excerpt: route owner-provided facts to summary before research or drafting.

Expected planner output:

```text
decision.routing.next = context_collect
stage_plan = summarize facts, mark unknowns, recommend research or knowledge draft
selected_agent = context_collector
```

Selected agent: `context_collector`.

Compiled `agent_input`: owner sentence, prior onboarding facet, empty `identity-profile-history`.

Rendered agent prompt excerpt: separate facts, assumptions, unknowns; do not invent domain/offers.

Expected agent output/facet:

```text
facets.context_summary.known_facts = Owner wants help running a small business.
facets.context_summary.assumptions = Domain, audience, offerings, operating area, and tone are unknown.
facets.context_summary.unknowns = purpose, business category, audience, offers, authority limits.
facets.vector_upsert.namespace = identity-profile-history
decision.routing.next = research_plan
```

Contract hydration summary: hydrate `facets.context_summary`.

Repo artifact writeback: conversation current-status records owner-provided context and unknowns.

Vector upsert summary: safe summary to `identity-profile-history`.

Usage event summary: route `context_collect`, agent `context_collector`, vector upsert allowed.

Final route or stop condition: next route `research_plan`.

## Scenario 3: Non-Owner Asks For A Quote Before Maturity

Input runtime contract excerpt:

```text
msg.summary = Non-owner asks: "Can you quote this for me?"
authority.owner_verified = false
authority.trust_level = unverified_external
lifecycle_mode = seed_runtime_available
facets.context_summary = none
```

Compiled `planner_input`: unverified sender, quote request, no pricing policy, no external send authority.

Rendered planner prompt excerpt: non-owner inbound cannot mature identity; pricing/commitments route to review.

Expected planner output:

```text
decision.routing.next = human_review
stage_plan = package quote request and authority boundary; do not quote
selected_agent = human_review
```

Selected agent: `human_review`.

Compiled `agent_input`: quote request, blocked pricing/commitment authority, tools `repo_read`, `human_review_packet_create`, `usage_event_emit`.

Rendered agent prompt excerpt: identify authority issue and safe default.

Expected agent output/facet:

```text
facets.human_review.summary = Quote request arrived before approved pricing, offering, or external reply policy.
facets.human_review.decision_needed = Human decides whether and how to respond.
facets.human_review.safe_default = Do not quote, schedule, or commit.
decision.routing.next = stop
```

Contract hydration summary: hydrate `facets.human_review`.

Repo artifact writeback: human review packet or current-status note.

Vector upsert summary: optional safe `human-review-history` summary only; no audience memory.

Usage event summary: route `human_review`, agent `human_review`.

Final route or stop condition: `stop`.

## Scenario 4: Missing Lead Qualification Capability Becomes A Proposal

Input runtime contract excerpt:

```text
msg.summary = Runtime detects external intake/lead qualification would be useful.
authority.owner_verified = true
facets.context_summary.unknowns = audience, offerings, commitment policy.
```

Compiled `planner_input`: verified owner context, useful capability missing, activation prohibited.

Rendered planner prompt excerpt: record gap before proposal; keep inactive.

Expected planner output:

```text
decision.routing.next = capability_gap
stage_plan = record blocked outcome, safe default, then propose inactive capability
selected_agent = capability_gap_manager
```

Selected agent: `capability_gap_manager`.

Compiled `agent_input`: blocked outcome, active tools, output contract `capability_gap`.

Rendered agent prompt excerpt: describe blocker in owner-visible terms, no activation.

Expected agent output/facet:

```text
facets.capability_gap.gap = Lead or intake qualification is not active.
facets.capability_gap.blocked_action = Qualifying external requests without approved audience/offering/authority.
facets.capability_gap.safe_default = Route external requests to human_review.
decision.routing.next = capability_proposal
```

Contract hydration summary: hydrate `facets.capability_gap`.

Repo artifact writeback: append or propose update to `identity_state/capability_evolution/gaps.md`.

Vector upsert summary: `capability-gap-history`.

Usage event summary: route `capability_gap`, agent `capability_gap_manager`.

Next route:

```text
selected_agent = capability_proposal_writer
facets.capability_proposal.name = lead_or_intake_qualification
facets.capability_proposal.status = proposed_inactive
facets.capability_proposal.owner_approval_question = I recommend preparing intake as a draft-only capability first. Should I prepare the activation checklist?
decision.routing.next = human_review
```

Final route or stop condition: `human_review`; activation remains blocked.
