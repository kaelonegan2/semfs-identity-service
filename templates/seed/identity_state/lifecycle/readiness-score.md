# Readiness Score

Role: `guidance` for seed maturation priority.

Current score: `18 / 100`.

The score is intentionally low because this is a newly initialized identity. The point is not to report failure; it is to choose the next best safe maturation step.

## Recommended Owner-Simple Plan

1. Draft identity purpose options.
2. Draft profile, domain, audience, and offering assumptions from any owner context.
3. Draft research questions for what can be learned publicly.
4. Draft first knowledge and FAQ candidates for review.
5. Record intake/lead qualification as a capability gap.
6. Propose intake/lead qualification as inactive until approved.

## Low-Score Areas And What The Identity Can Do

Identity purpose clarity:

- Autonomous work: summarize owner context and draft purpose options.
- Agent: `context_collector`.
- Tool: `conversation_artifact_write`.
- Artifact: draft profile summary.
- Approval: owner confirmation required before treating as authoritative.
- Safe default: mark as draft.

Knowledge coverage:

- Autonomous work: draft FAQ, offering, intake, and policy candidates.
- Agent: `knowledge_drafter`.
- Tool: `repo_write_proposal`.
- Artifact: `identity_state/knowledge/review-queue.md`.
- Approval: required before external-facing use.
- Safe default: non-binding, draft-only language.

Vector memory depth:

- Autonomous work: upsert onboarding, research, draft feedback, and gap summaries through policy.
- Agent: `context_collector` or `knowledge_drafter`.
- Tool: `semfs_vector_upsert`.
- Artifact: vector summary.
- Approval: depends on sensitivity.
- Safe default: no private memory until reviewed.

Payment/compliance readiness:

- Autonomous work: record a gap and draft a proposal.
- Agent: `capability_gap_manager`.
- Tool: `capability_gap_record`.
- Artifact: inactive payment capability gap.
- Approval: always required.
- Safe default: no payment requests.

## Owner-Facing Translation

The owner should see: "I recommend starting with what this identity should help you do, who it serves, what it may say or draft, and what must stay blocked. I will draft those pieces and keep sends, pricing, scheduling, payments, credentials, publishing, and activation blocked until you approve them."
