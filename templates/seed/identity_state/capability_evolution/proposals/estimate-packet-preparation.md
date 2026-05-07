# Proposed Capability: Estimate Or Commitment Packet Preparation

Role: `proposal`.

Status: `proposed_inactive`.

## Benefit

Prepare internal packets for owner review when a request needs pricing, scope, delivery, timeline, or commitment decisions.

## Required Before Activation

- approved intake fields
- approved pricing or commitment posture
- approved scope boundaries
- human review process for all commitments
- evals for final-price and scheduling refusal

## Runtime Support

- `repo_read`
- `repo_write_proposal`
- `semfs_vector_retrieve`
- `human_review_packet_create`

## Owner Approval Question

I recommend keeping estimate or commitment packets internal and review-only until your rules are approved. Is that acceptable?

Safe default if unanswered: no estimate or commitment packets.
