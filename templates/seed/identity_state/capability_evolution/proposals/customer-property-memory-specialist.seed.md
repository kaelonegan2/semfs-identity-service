# Proposed Specialist: Private Audience Or Property Memory

Role: `proposal`.

Status: `proposed_inactive`.

## Benefit

Remember reviewed private context, preferences, and recurring constraints for better future service after the owner approves privacy rules.

## Required Before Activation

- owner-approved privacy policy
- route-scoped retrieval policy
- sensitive memory upsert rules
- human review for high-risk memory
- evals for privacy leakage and incorrect recall

## Runtime Support

- `semfs_vector_retrieve`
- `semfs_vector_upsert`
- `structured_output_validate`
- `human_review_packet_create`

## Owner Approval Question

I recommend waiting to activate private memory until we have a clear privacy policy and reviewed workflows. Is that acceptable?

Safe default if unanswered: no private audience or property memory.
