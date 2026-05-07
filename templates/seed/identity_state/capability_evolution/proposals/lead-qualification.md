# Proposed Capability: Lead Or Intake Qualification

Role: `proposal`.

Status: `proposed_inactive`.

## Benefit

Help the identity collect enough inbound context to decide whether a request is relevant, while avoiding premature price, schedule, scope, eligibility, or service commitments.

## Required Before Activation

- owner-approved identity purpose
- owner-approved audience or eligibility assumptions
- owner-approved offering or responsibility categories
- owner-approved intake questions
- approved external-facing tone
- external send policy and approval path
- evals for quote, scheduling, non-owner, and authority-boundary cases

## Runtime Support

- `repo_read`
- `conversation_artifact_write`
- `semfs_vector_retrieve`
- `semfs_vector_upsert`
- `human_review_packet_create`
- optional `email_draft_prepare`

## Authority Limits

No final pricing, scheduling, payment request, external send, or commitment without approval.

## Owner Approval Question

I recommend preparing intake as the first future external-facing capability, but keeping replies draft-only until your audience, offerings, and commitment rules are approved. Should I prepare the activation checklist?

Safe default if unanswered: keep intake qualification inactive.
