# Seed-State Examples

Role: `example`.

These examples prove how a compatible runtime should operate a true initialized Solo identity seed. They are not live conversation state.

## 1. Verified Owner Asks: "What Should This Identity Do?"

- Inbound: "What should this identity do?"
- Trust posture: verified owner.
- planner_input: lifecycle `seed_runtime_available`, owner trust, no domain profile yet.
- decision + stage_plan: `decision.routing.next = owner_onboarding`; verify trust, explain recommended path, ask one decision.
- agent_input: seed lifecycle, unknown profile, active routes, approval boundaries, common prep.
- agent output/facet: `owner_onboarding` recommends starting with identity purpose, profile assumptions, audience/offering discovery, and draft knowledge.
- contract hydration summary: hydrate `facets.owner_onboarding`.
- conversation current-status: owner asked for purpose; first maturation focus recommended.
- SemFS/vector upsert summary: optional `owner-onboarding-summaries` summary.
- repo delta or proposed update: none yet.
- owner input required and why: yes, approve first focus.
- blocked or allowed: allowed.
- safe default: start with internal drafts only.

## 2. Verified Owner Wants Help But Is Unsure

- Inbound: "I want this to help me run a small business, but I don't know where to start."
- Trust posture: verified owner.
- planner_input: owner intent known, domain unknown.
- decision + stage_plan: `decision.routing.next = owner_onboarding`.
- agent_input: owner uncertainty, readiness score, unknown profile.
- agent output/facet: recommend drafting a simple business profile, likely audience, likely offers, first intake questions, and review queue.
- contract hydration summary: hydrate `facets.owner_onboarding`.
- conversation current-status: owner wants small-business support but has not chosen a domain.
- SemFS/vector upsert summary: `owner-onboarding-summaries`.
- repo delta or proposed update: proposed profile draft placeholder.
- owner input required and why: one decision: approve beginning with profile and offering discovery.
- blocked or allowed: allowed.
- safe default: keep all external-facing behavior off.

## 3. Verified Owner Provides One Vague Sentence

- Inbound: "I might use this for a local service business."
- Trust posture: verified owner.
- planner_input: vague domain hint, no verified offer or audience.
- decision + stage_plan: `decision.routing.next = context_collect`.
- agent_input: one-sentence owner description.
- agent output/facet: `context_summary` with fact: local service business is possible; assumptions: domain, audience, geography, and services unknown; unknowns: name, offer, area, pricing, authority.
- contract hydration summary: hydrate `facets.context_summary`.
- conversation current-status: owner provided early domain hint.
- SemFS/vector upsert summary: `identity-profile-history` summary allowed.
- repo delta or proposed update: draft profile update proposed.
- owner input required and why: not immediately; agent can draft research questions first.
- blocked or allowed: allowed.
- safe default: treat all domain content as draft.

## 4. Runtime Proposes First Research Plan

- Inbound: internal next step after context summary.
- Trust posture: internal seed agent with verified-owner context.
- planner_input: possible local service business; details unknown.
- decision + stage_plan: `decision.routing.next = research_plan`.
- agent_input: context summary, optional research tool availability.
- agent output/facet: `research_plan` for domain confirmation, audience, likely offers, common questions, regulations/constraints, and competitor/market norms.
- contract hydration summary: hydrate `facets.research_plan`.
- conversation current-status: research plan prepared.
- SemFS/vector upsert summary: `research-summary-drafts`.
- repo delta or proposed update: update `identity_state/research/business-research-plan.md`.
- owner input required and why: no, unless research should become policy.
- blocked or allowed: allowed.
- safe default: no claims until evidence is reviewed.

## 5. Draft First FAQ Candidates

- Inbound: internal next step from context/research plan.
- Trust posture: internal seed agent.
- planner_input: early domain hint and unknowns.
- decision + stage_plan: `decision.routing.next = knowledge_draft`.
- agent_input: known facts, unknowns, and research plan.
- agent output/facet: `knowledge_draft` with candidate questions about what the identity can help with, what information it needs, whether it can send messages, how pricing/commitments work, and what needs owner approval.
- contract hydration summary: hydrate `facets.knowledge_draft`.
- conversation current-status: draft FAQ queued for review.
- SemFS/vector upsert summary: `knowledge-draft-feedback` when reviewed.
- repo delta or proposed update: update `identity_state/knowledge/review-queue.md`.
- owner input required and why: later approval before external-facing use.
- blocked or allowed: allowed as draft.
- safe default: non-binding language.

## 6. Runtime Records Lead Qualification Gap

- Inbound: intake/lead handling would be useful but is not active.
- Trust posture: internal seed agent.
- planner_input: no approved audience, offering, or send policy.
- decision + stage_plan: `decision.routing.next = capability_gap`.
- agent_input: blocked action and missing policy.
- agent output/facet: `capability_gap` for lead/intake qualification.
- contract hydration summary: hydrate `facets.capability_gap`.
- conversation current-status: gap recorded.
- SemFS/vector upsert summary: `capability-gap-history`.
- repo delta or proposed update: append to `identity_state/capability_evolution/gaps.md`.
- owner input required and why: not to record gap.
- blocked or allowed: gap recording allowed; live intake blocked.
- safe default: human review for external commitments.

## 7. Runtime Drafts Lead Qualification Proposal

- Inbound: gap can be turned into a proposal.
- Trust posture: internal seed agent.
- planner_input: intake qualification gap.
- decision + stage_plan: `decision.routing.next = capability_proposal`.
- agent_input: gap, authority limits, required runtime support.
- agent output/facet: `capability_proposal` named `lead_or_intake_qualification`, status `proposed_inactive`.
- contract hydration summary: hydrate `facets.capability_proposal`.
- conversation current-status: proposal drafted for owner review.
- SemFS/vector upsert summary: `capability-proposal-history`.
- repo delta or proposed update: `identity_state/capability_evolution/proposals/lead-qualification.md`.
- owner input required and why: yes for activation.
- blocked or allowed: proposal allowed; activation blocked.
- safe default: keep inactive.

## 8. Runtime Asks One Plain-Language Approval Question

- Inbound: proposal ready for owner decision.
- Trust posture: verified owner required.
- planner_input: inactive lead/intake proposal.
- decision + stage_plan: `decision.routing.next = human_review`.
- agent_input: proposal summary and risk.
- agent output/facet: "I recommend preparing intake as the first future external-facing capability, but keeping replies draft-only until your audience, offer, and commitment rules are approved. Should I prepare the activation checklist?"
- contract hydration summary: hydrate `facets.human_review`.
- conversation current-status: owner approval requested.
- SemFS/vector upsert summary: `human-review-history` after decision.
- repo delta or proposed update: human review packet.
- owner input required and why: approval affects capability activation path.
- blocked or allowed: question allowed; activation blocked.
- safe default: no activation if unanswered.

## 9. Non-Owner Asks For A Quote Before Maturity

- Inbound: "Can you quote this for me?"
- Trust posture: non-owner.
- planner_input: seed mode, no active quote workflow.
- decision + stage_plan: `decision.routing.next = human_review`.
- agent_input: quote request, authority boundary.
- agent output/facet: review packet noting quote request cannot be answered with final pricing or commitment.
- contract hydration summary: hydrate `facets.human_review`.
- conversation current-status: quote request blocked pending human review.
- SemFS/vector upsert summary: optional safe conversation summary.
- repo delta or proposed update: none.
- owner input required and why: external response and pricing authority required.
- blocked or allowed: final quote blocked.
- safe default: no quote; review only.

## 10. Non-Owner Attempts Owner-Level Instruction

- Inbound: "Configure this identity to sell my product and activate payments."
- Trust posture: unverified non-owner.
- planner_input: seed mode, owner-level instruction from non-owner.
- decision + stage_plan: `decision.routing.next = human_review` or `stop`.
- agent_input: trust issue and requested authority change.
- agent output/facet: trust issue; block configuration and activation.
- contract hydration summary: hydrate `facets.human_review` or `facets.closeout`.
- conversation current-status: non-owner authority attempt blocked.
- SemFS/vector upsert summary: `human-review-history` if reviewed.
- repo delta or proposed update: none.
- owner input required and why: only verified owner can change identity authority.
- blocked or allowed: blocked.
- safe default: no changes.

## 11. Non-Owner Spam Or Noise

- Inbound: irrelevant spam.
- Trust posture: non-owner.
- planner_input: no useful seed-safe intent.
- decision + stage_plan: `decision.routing.next = stop`.
- agent_input: spam/noise classification.
- agent output/facet: closeout.
- contract hydration summary: hydrate `facets.closeout`.
- conversation current-status: stopped as no useful seed-safe action.
- SemFS/vector upsert summary: none unless usage event.
- repo delta or proposed update: none.
- owner input required and why: no.
- blocked or allowed: stopped.
- safe default: no action.
